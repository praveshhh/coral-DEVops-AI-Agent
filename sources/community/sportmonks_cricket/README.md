# SportMonks Cricket

Query cricket players, career statistics, and match fixtures from the
[SportMonks Cricket API](https://sportmonks.com/cricket-api) as SQL tables.
Normalizes deeply nested JSON — career arrays, inline team objects, venue
includes — into flat, typed columns ready for AI-agent analytics.

## Tables

| Table | Description | Required filters | Optional filters |
|-------|-------------|-----------------|-----------------|
| `sportmonks_cricket.players` | Player profiles with name, country_id, batting and bowling style | — | `player_id`, `name`, `country_id` |
| `sportmonks_cricket.player_career_stats` | Batting and bowling career stats per format and team | `player_id` | — |
| `sportmonks_cricket.fixtures` | Match fixtures with teams, venue, status, and result | — | `league_id`, `season_id`, `localteam_id`, `visitorteam_id`, `status`, `starts_between` |

## Authentication

Requires `SPORTMONKS_API_TOKEN`.

**To get your API token:**

1. Sign up at [sportmonks.com](https://sportmonks.com/cricket-api)
2. Go to **My Account > API Token** in the dashboard
3. Copy the token

The connector appends the token as an `api_token` query parameter to every API request.

> [!IMPORTANT]
> **SportMonks Cricket Plan Access:** If you are on the free/trial plan, your API access is limited to league IDs `3`, `10`, and `5`. Querying data outside these leagues will result in a `403 Forbidden` response.

## Install

```bash
coral source add --file sources/community/sportmonks_cricket/manifest.yaml
coral source test sportmonks_cricket
```

Or with the token inline:

```bash
SPORTMONKS_API_TOKEN=your-token coral source add --file sources/community/sportmonks_cricket/manifest.yaml
```

## Example queries

Discover players:

```sql
SELECT id, fullname, country_id, battingstyle, bowlingstyle
FROM sportmonks_cricket.players
LIMIT 20;
```

Fetch a specific player profile:

```sql
SELECT id, fullname, country_id, battingstyle, bowlingstyle
FROM sportmonks_cricket.players
WHERE player_id = 30;
```

Career stats for a specific player:

```sql
SELECT
  player_id,
  type,
  batting_matches,
  batting_average,
  batting_strike_rate,
  bowling_wickets,
  bowling_economy_rate
FROM sportmonks_cricket.player_career_stats
WHERE player_id = 30;
```

Fetch career stats joined with player profile:

```sql
SELECT
  p.fullname,
  p.battingstyle,
  s.type,
  s.batting_matches,
  s.batting_runs_scored,
  s.batting_average,
  s.batting_strike_rate
FROM sportmonks_cricket.player_career_stats s
JOIN sportmonks_cricket.players p
  ON s.player_id = p.id
WHERE s.player_id = 30 AND p.player_id = 30;
```

Browse recent fixtures:

```sql
SELECT
  id,
  localteam_name,
  visitorteam_name,
  type,
  status,
  starting_at,
  venue_name,
  venue_city
FROM sportmonks_cricket.fixtures
WHERE league_id = 3
ORDER BY starting_at DESC
LIMIT 20;
```

Finished matches for a league:

```sql
SELECT
  id,
  localteam_name,
  visitorteam_name,
  winner_team_id,
  man_of_match_id,
  starting_at
FROM sportmonks_cricket.fixtures
WHERE league_id = 3 AND status = 'Finished'
ORDER BY starting_at DESC;
```

## Schema reference

### `sportmonks_cricket.players`

| Column | Type | Description |
| --- | --- | --- |
| `id` | Int64 | Unique SportMonks player ID. |
| `country_id` | Int64 | Country ID. |
| `firstname` | Utf8 | First name. |
| `lastname` | Utf8 | Last name. |
| `fullname` | Utf8 | Full display name. |
| `image_path` | Utf8 | Profile image URL. |
| `dateofbirth` | Utf8 | Date of birth (YYYY-MM-DD). |
| `gender` | Utf8 | Gender (m / f). |
| `battingstyle` | Utf8 | Batting style. |
| `bowlingstyle` | Utf8 | Bowling style. |
| `player_id` | Int64 | Echoes the optional player_id filter used for single-player lookups. |
| `name` | Utf8 | Exposes the optional name filter for provider-side player name search. |

Filters: `player_id` (optional), `name` (optional), `country_id` (optional) — omit to browse all players.

### `sportmonks_cricket.player_career_stats`

| Column | Type | Description |
| --- | --- | --- |
| `player_id` | Int64 | Player ID; join to `players.id`. |
| `season_id` | Int64 | Season ID for this record. |
| `team_id` | Int64 | Team ID for this record. |
| `type` | Utf8 | Match format: Test, ODI, T20I, First-class, etc. |
| `batting_matches` | Int64 | Matches played (batting). |
| `batting_innings` | Int64 | Innings batted. |
| `batting_runs_scored` | Int64 | Total runs scored. |
| `batting_average` | Float64 | Batting average. |
| `batting_strike_rate` | Float64 | Batting strike rate. |
| `batting_highest_inning_score` | Utf8 | Highest score in a single innings. |
| `batting_hundreds` | Int64 | Number of centuries. |
| `batting_fifties` | Int64 | Number of half-centuries. |
| `batting_fours` | Int64 | Total fours hit. |
| `batting_sixes` | Int64 | Total sixes hit. |
| `bowling_matches` | Int64 | Matches played (bowling). |
| `bowling_innings` | Int64 | Innings bowled. |
| `bowling_wickets` | Int64 | Total wickets taken. |
| `bowling_economy_rate` | Float64 | Economy rate (runs per over). |
| `bowling_average` | Float64 | Bowling average (runs per wicket). |
| `bowling_strike_rate` | Float64 | Bowling strike rate (balls per wicket). |
| `bowling_best_bowling` | Utf8 | Best bowling figures in a single innings (e.g. 5/23). |

Filters: `player_id` (**required**).

### `sportmonks_cricket.fixtures`

| Column | Type | Description |
| --- | --- | --- |
| `id` | Int64 | Unique fixture ID. |
| `league_id` | Int64 | League ID. |
| `season_id` | Int64 | Season ID. |
| `stage_id` | Int64 | Stage or round ID. |
| `round` | Utf8 | Round label. |
| `localteam_id` | Int64 | Home team ID. |
| `localteam_name` | Utf8 | Home team name. |
| `localteam_code` | Utf8 | Home team code (e.g. IND). |
| `visitorteam_id` | Int64 | Away team ID. |
| `visitorteam_name` | Utf8 | Away team name. |
| `visitorteam_code` | Utf8 | Away team code (e.g. ENG). |
| `venue_id` | Int64 | Venue ID. |
| `venue_name` | Utf8 | Venue name. |
| `venue_city` | Utf8 | Venue city. |
| `venue_country_id` | Int64 | Country ID of the venue resolved from the venue include. |
| `type` | Utf8 | Match type: Test, ODI, T20, etc. |
| `status` | Utf8 | Status: NS, Finished, 1st Innings, 2nd Innings, Int., Aban., Cancl., etc. |
| `starting_at` | Timestamp | Match start datetime in UTC. |
| `winner_team_id` | Int64 | Winning team ID (null if unfinished). |
| `man_of_match_id` | Int64 | Man of the match player ID (null if unawarded). |
| `total_overs_played` | Int64 | Total overs bowled. |
| `starts_between` | Utf8 | Custom filter to get fixtures played between two dates (format YYYY-MM-DD,YYYY-MM-DD). |

Filters: `league_id` (optional), `season_id` (optional), `localteam_id` (optional), `visitorteam_id` (optional), `status` (optional), `starts_between` (optional).

## Notes

- All tables are read-only. This source does not create, modify, or delete
  any SportMonks data.
- The `fixtures` endpoint in SportMonks Cricket API v2.0 uses page-based pagination with `page` and
  `per_page` query parameters. The default page size is 100, and the maximum allowed is 150. The `players` endpoint does not support paging.
- The `player_career_stats` table expands the nested `career.data` array
  returned by `/players/{id}?include=career`. Each element is one
  format-team career record.
- Nested team and venue objects in the `fixtures` response are resolved
  inline via the `localteam,visitorteam,venue` include and flattened
  into scalar columns.
- SportMonks rate limits vary by plan. Add `LIMIT` clauses and use
  specific filters to avoid exhausting your request quota.
- The `player_career_stats` table always requires `player_id`. There is
  no endpoint that returns career stats for all players in one call.
