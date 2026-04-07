## R Code Writing

When writing R code, follow these modern patterns:

### Core Principles
- Always use native pipe `|>` (not magrittr `%>%`)
- Profile before optimizing: use `profvis` for unknown bottlenecks, `bench::mark()` for comparing alternatives
- Write readable code first; optimize only when necessary

### Joins (dplyr 1.1+)
Use `join_by()` instead of character vectors. Supports inequality, rolling, and overlap joins.

```r
# Modern join syntax
transactions |>
  inner_join(companies, by = join_by(company == id))

# Inequality join
transactions |>
  inner_join(companies, join_by(company == id, year >= since))

# Quality control
inner_join(x, y, by = join_by(id), multiple = "error")
inner_join(x, y, by = join_by(id), unmatched = "error")
```

### Data Masking
Use `{{}}` (embrace) for function arguments; use `.data[[]]` for character vectors.

```r
my_summary <- function(data, group_var, summary_var) {
  data |>
    group_by({{ group_var }}) |>
    summarise(mean_val = mean({{ summary_var }}))
}

for (var in names(mtcars)) {
  mtcars |> count(.data[[var]]) |> print()
}
```

### Per-Operation Grouping (dplyr 1.1+)
Use `.by` instead of `group_by()` + `ungroup()` — always returns ungrouped.

```r
data |> summarise(mean_value = mean(value), .by = category)
data |> reframe(quantiles = quantile(x, c(0.25, 0.5, 0.75)), .by = group)
data |> summarise(across(where(is.numeric), mean, .names = "mean_{.col}"), .by = group)
```

### rlang Metaprogramming

| Operator | Use Case |
|----------|----------|
| `{{ }}` | Forward function arguments |
| `!!` | Inject single expression/value |
| `!!!` | Inject multiple arguments |
| `.data[[]]` | Access columns by name string |

```r
# Name injection with glue syntax
my_mean <- function(data, var) {
  data |> dplyr::summarise("mean_{{ var }}" := mean({{ var }}))
}

# Pronouns for disambiguation
cyl <- 1000
mtcars |> dplyr::summarise(
  data_cyl = mean(.data$cyl),    # column value
  env_cyl  = mean(.env$cyl)      # local variable
)

# Splicing
vars <- c("cyl", "am")
mtcars |> dplyr::group_by(!!!syms(vars))
```

Never use string eval — use `sym()` instead:
```r
# Bad:
eval(parse(text = paste("mean(", var, ")")))

# Good:
!!sym(var)
```

### purrr 1.0+
- `map() |> list_rbind()` replaces deprecated `map_dfr()`
- `map() |> list_cbind()` replaces deprecated `map_dfc()`
- Use `walk()` for side effects

### stringr (prefer over base R)

| Base R | stringr |
|--------|---------|
| `grepl(pattern, x)` | `str_detect(x, pattern)` |
| `gsub(a, b, x)` | `str_replace_all(x, a, b)` |
| `tolower(x)` | `str_to_lower(x)` |
| `nchar(x)` | `str_length(x)` |
| `substr(x, 1, 5)` | `str_sub(x, 1, 5)` |

### SAS Files
⚠️ When you see a `.sas7bdat` file, ALWAYS load it with R using haven::read_sas — never try to read it as raw text:

```r
library(haven)
data <- haven::read_sas("file.sas7bdat")
```
