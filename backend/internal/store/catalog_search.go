package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

type CatalogSearchParams struct {
	Q          string
	Type       string
	BodyPart   string
	Equipment  string
	Level      string
	Muscle     string
	Page       int
	PageSize   int
	Sort       string
}

type CatalogFacets struct {
	Types      []string `json:"types"`
	BodyParts  []string `json:"bodyParts"`
	Equipment  []string `json:"equipment"`
	Levels     []string `json:"levels"`
	Muscles    []string `json:"muscles"`
}

func (c *Catalog) Facets(ctx context.Context) (CatalogFacets, error) {
	var f CatalogFacets
	if err := c.db.SelectContext(ctx, &f.Types, `select name from exercise_types order by name`); err != nil {
		return f, err
	}
	if err := c.db.SelectContext(ctx, &f.BodyParts, `select name from body_parts order by name`); err != nil {
		return f, err
	}
	if err := c.db.SelectContext(ctx, &f.Equipment, `select name from equipment_types order by name`); err != nil {
		return f, err
	}
	if err := c.db.SelectContext(ctx, &f.Levels, `select name from levels order by name`); err != nil {
		return f, err
	}
	if err := c.db.SelectContext(ctx, &f.Muscles, `
with m as (
  select primary_muscle as m from exercise_catalog where primary_muscle is not null
  union
  select unnest(secondary_muscles) as m from exercise_catalog where secondary_muscles is not null
)
select distinct m from m where m is not null order by 1
`); err != nil {
		return f, err
	}
	return f, nil
}

type CatalogItem struct {
	ID                string   `db:"id" json:"id"`
	Name              string   `db:"name" json:"name"`
	Type              *string  `db:"type" json:"type,omitempty"`
	BodyPart          *string  `db:"body_part" json:"bodyPart,omitempty"`
	Equipment         *string  `db:"equipment" json:"equipment,omitempty"`
	Level             *string  `db:"level" json:"level,omitempty"`
	PrimaryMuscle     *string  `db:"primary_muscle" json:"primaryMuscle,omitempty"`
	SecondaryMuscles  []string `db:"secondary_muscles" json:"secondaryMuscles,omitempty"`
}

type CatalogSearchResult struct {
	Items   []CatalogItem `json:"items"`
	Page    int           `json:"page"`
	PageSize int          `json:"pageSize"`
	Total   int           `json:"total"`
	HasMore bool          `json:"hasMore"`
}

func (c *Catalog) Search(ctx context.Context, p CatalogSearchParams) (CatalogSearchResult, error) {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 || p.PageSize > 100 {
		p.PageSize = 20
	}
	sort := "name asc"
	if strings.EqualFold(p.Sort, "name_desc") {
		sort = "name desc"
	}
	where := []string{}
	args := []any{}
	arg := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}
	if p.Q != "" {
		q := "%" + p.Q + "%"
		where = append(where, fmt.Sprintf("(name ILIKE %s OR COALESCE(description,'') ILIKE %s)", arg(q), arg(q)))
	}
	if p.Type != "" {
		where = append(where, fmt.Sprintf("type = %s", arg(p.Type)))
	}
	if p.BodyPart != "" {
		where = append(where, fmt.Sprintf("body_part = %s", arg(p.BodyPart)))
	}
	if p.Equipment != "" {
		where = append(where, fmt.Sprintf("equipment = %s", arg(p.Equipment)))
	}
	if p.Level != "" {
		where = append(where, fmt.Sprintf("level = %s", arg(p.Level)))
	}
	if p.Muscle != "" {
		where = append(where, fmt.Sprintf("(primary_muscle = %s OR %s = ANY(COALESCE(secondary_muscles,'{}'::text[])))", arg(p.Muscle), arg(p.Muscle)))
	}
	cond := ""
	if len(where) > 0 {
		cond = "WHERE " + strings.Join(where, " AND ")
	}
	// total
	var total int
	if err := c.db.QueryRowxContext(ctx, "SELECT count(*) FROM exercise_catalog "+cond, args...).Scan(&total); err != nil {
		return CatalogSearchResult{}, err
	}
	// items
	argsItems := append([]any{}, args...)
	argsItems = append(argsItems, p.PageSize, (p.Page-1)*p.PageSize)
	query := `
SELECT
  id,
  name,
  type,
  body_part,
  equipment,
  level,
  primary_muscle,
  COALESCE(array_to_json(secondary_muscles), '[]'::json) AS secondary_muscles
FROM exercise_catalog
` + cond + `
ORDER BY ` + sort + `
LIMIT $` + fmt.Sprint(len(args)+1) + ` OFFSET $` + fmt.Sprint(len(args)+2)
	rows, err := c.db.QueryxContext(ctx, query, argsItems...)
	if err != nil {
		return CatalogSearchResult{}, err
	}
	defer rows.Close()
	items := make([]CatalogItem, 0)
	for rows.Next() {
		var (
			it   CatalogItem
			jsonMuscles []byte
		)
		if err := rows.Scan(
			&it.ID,
			&it.Name,
			&it.Type,
			&it.BodyPart,
			&it.Equipment,
			&it.Level,
			&it.PrimaryMuscle,
			&jsonMuscles,
		); err != nil {
			return CatalogSearchResult{}, err
		}
		if len(jsonMuscles) > 0 {
			var sec []string
			if err := json.Unmarshal(jsonMuscles, &sec); err == nil {
				it.SecondaryMuscles = sec
			}
		}
		if it.SecondaryMuscles == nil {
			it.SecondaryMuscles = []string{}
		}
		items = append(items, it)
	}
	return CatalogSearchResult{
		Items: items,
		Page: p.Page,
		PageSize: p.PageSize,
		Total: total,
		HasMore: p.Page * p.PageSize < total,
	}, nil
}


