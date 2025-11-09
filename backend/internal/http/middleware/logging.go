package middleware

import (
	"log"
	"net/http"
	"time"
)

type responseRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (rr *responseRecorder) WriteHeader(status int) {
	rr.status = status
	rr.ResponseWriter.WriteHeader(status)
}

func (rr *responseRecorder) Write(p []byte) (int, error) {
	if rr.status == 0 {
		rr.status = http.StatusOK
	}
	n, err := rr.ResponseWriter.Write(p)
	rr.bytes += n
	return n, err
}

// RequestLogger logs method, path, status code, duration, and the authenticated
// user (when present) for every request that passes through the router.
func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &responseRecorder{ResponseWriter: w}
		next.ServeHTTP(rec, r)

		duration := time.Since(start)
		userID, _ := UserIDFromContext(r.Context())
		log.Printf("[http] %s %s %d %dB in %s user=%s remote=%s",
			r.Method,
			r.URL.Path,
			rec.status,
			rec.bytes,
			duration.Round(time.Millisecond),
			userID,
			r.RemoteAddr,
		)
	})
}
