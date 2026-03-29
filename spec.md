# Stock Scanner

## Current State
New project with no existing application files.

## Requested Changes (Diff)

### Add
- Full-stack stock scanner app with simulated data
- Main scanner table: Ticker, Company, Price, % Change, Float, Relative Volume, Market Cap, Catalyst columns
- Ross Cameron 5 Pillars filter preset (float < 20M, rel vol > 2x, has catalyst, price < $20, technical breakout)
- Momentum Scanner panel: stocks with large % moves in configurable time windows (1-min, 5-min)
- Custom filter builder: price range, float max, rel vol min, % change min
- Sortable and filterable table columns
- Watchlist: pin/unpin stocks, persist in backend
- Color-coded rows: green for strong gainers, red for losers, yellow for momentum alerts
- Dark trading-platform UI (dark charcoal background, teal accents, green/red coding)
- Simulated stock data (~30 stocks) with auto-refresh simulation

### Modify
- None

### Remove
- None

## Implementation Plan
1. Backend: Store watchlist tickers per anonymous user; provide simulated stock data with all required fields
2. Backend: Expose APIs for get/add/remove watchlist, get stock data
3. Frontend: Main layout with header nav, filter strip, two-column main+sidebar
4. Frontend: Scanner table with sort/filter, color-coded rows, catalyst tags
5. Frontend: Ross Cameron 5 Pillars preset button that auto-applies all five filters
6. Frontend: Momentum Scanner panel showing top movers by 1-min/5-min % change
7. Frontend: Custom filter builder panel with controls for each filter dimension
8. Frontend: Watchlist sidebar with pin/unpin
9. Frontend: Simulated live data refresh (client-side random walk every few seconds)
