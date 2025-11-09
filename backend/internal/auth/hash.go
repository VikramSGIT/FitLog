package auth

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

// HashPassword returns a string encoding parameters, salt, and hash.
// Format: argon2id$v=19$m=65536,t=3,p=2$<salt_b64>$<hash_b64>
func HashPassword(plain string) (string, error) {
	if len(plain) == 0 {
		return "", fmt.Errorf("empty password")
	}
	var (
		memory      uint32 = 64 * 1024
		iterations  uint32 = 3
		parallelism uint8  = 2
		saltLen            = 16
		keyLen             = 32
	)
	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("salt: %w", err)
	}
	hash := argon2.IDKey([]byte(plain), salt, iterations, memory, parallelism, uint32(keyLen))
	saltB64 := base64.RawStdEncoding.EncodeToString(salt)
	hashB64 := base64.RawStdEncoding.EncodeToString(hash)
	encoded := fmt.Sprintf("argon2id$v=19$m=%d,t=%d,p=%d$%s$%s", memory, iterations, parallelism, saltB64, hashB64)
	return encoded, nil
}

func VerifyPassword(encoded, plain string) (bool, error) {
	if len(encoded) == 0 || len(plain) == 0 {
		return false, fmt.Errorf("invalid input")
	}
	// Accept both PHC ($argon2id$...) and our compact format (argon2id$...).
	if strings.HasPrefix(encoded, "$argon2id$") {
		// PHC format (robust parsing):
		//   $argon2id$v=19$m=65536,t=3,p=2$<salt_b64>$<hash_b64>
		// Some generators omit the v= segment: $argon2id$m=...,t=...,p=...$salt$hash
		parts := strings.Split(encoded, "$")
		// Expected: ["", "argon2id", ..., "<salt>", "<hash>"]
		if len(parts) < 5 {
			return false, fmt.Errorf("invalid phc format")
		}
		saltPart := parts[len(parts)-2]
		hashPart := parts[len(parts)-1]

		memory, iterations, parallelism, err := parsePHCParams(parts[2 : len(parts)-2])
		if err != nil {
			return false, err
		}

		salt, err := decodeB64(saltPart)
		if err != nil {
			return false, fmt.Errorf("salt decode: %w", err)
		}
		want, err := decodeB64(hashPart)
		if err != nil {
			return false, fmt.Errorf("hash decode: %w", err)
		}
		got := argon2.IDKey([]byte(plain), salt, iterations, memory, uint8(parallelism), uint32(len(want)))
		return constantTimeEqual(got, want), nil
	}

	// Compact format: argon2id$v=19$m=...,t=...,p=...$<salt>$<hash>
	if strings.HasPrefix(encoded, "argon2id$") {
		// Split on '$' similar to PHC
		// parts: ["argon2id", "v=19", "m=...,t=...,p=...", "<salt>", "<hash>"]
		parts := strings.Split(encoded, "$")
		if len(parts) < 5 {
			return false, fmt.Errorf("invalid compact format")
		}
		saltPart := parts[len(parts)-2]
		hashPart := parts[len(parts)-1]
		memory, iterations, parallelism, err := parsePHCParams(parts[1 : len(parts)-2])
		if err != nil {
			return false, err
		}
		salt, err := decodeB64(saltPart)
		if err != nil {
			return false, fmt.Errorf("salt decode: %w", err)
		}
		want, err := decodeB64(hashPart)
		if err != nil {
			return false, fmt.Errorf("hash decode: %w", err)
		}
		got := argon2.IDKey([]byte(plain), salt, iterations, memory, uint8(parallelism), uint32(len(want)))
		return constantTimeEqual(got, want), nil
	}
	return false, fmt.Errorf("unrecognized hash format")
}

func decodeB64(s string) ([]byte, error) {
	if b, err := base64.RawStdEncoding.DecodeString(s); err == nil {
		return b, nil
	}
	if b, err := base64.StdEncoding.DecodeString(s); err == nil {
		return b, nil
	}
	if b, err := base64.RawURLEncoding.DecodeString(s); err == nil {
		return b, nil
	}
	return base64.URLEncoding.DecodeString(s)
}

func constantTimeEqual(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	var diff byte
	for i := 0; i < len(a); i++ {
		diff |= a[i] ^ b[i]
	}
	return diff == 0
}

func parsePHCParams(segments []string) (memory uint32, iterations uint32, parallelism uint32, err error) {
	// segments may include "v=19" and one or more param strings like "m=...,t=...,p=...,keyid=...,data=..."
	var params string
	for _, seg := range segments {
		if strings.HasPrefix(seg, "m=") || strings.Contains(seg, "m=") {
			if params == "" {
				params = seg
			} else {
				params = params + "," + seg
			}
		}
	}
	if params == "" {
		return 0, 0, 0, fmt.Errorf("argon2 params missing")
	}
	// token-wise parse
	for _, tok := range strings.Split(params, ",") {
		if strings.HasPrefix(tok, "m=") {
			_, _ = fmt.Sscanf(tok, "m=%d", &memory)
		} else if strings.HasPrefix(tok, "t=") {
			_, _ = fmt.Sscanf(tok, "t=%d", &iterations)
		} else if strings.HasPrefix(tok, "p=") {
			_, _ = fmt.Sscanf(tok, "p=%d", &parallelism)
		}
	}
	if memory == 0 || iterations == 0 || parallelism == 0 {
		return 0, 0, 0, fmt.Errorf("invalid argon2 params")
	}
	return memory, iterations, parallelism, nil
}


