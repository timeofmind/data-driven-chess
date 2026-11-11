# Chess — a demonstration app for the data-driven framework

A game of chess at https://holmgren.ca/chess, written as data: the model
(`model/*.yaml`) says what a game, a player and a piece are and what a legal move
is; the pages (`pages/*.yaml`) say how they are shown. There is no code in this
repository. The [data-driven framework](https://github.com/timeofmind/data-driven-framework-go)
and its [Caddy handler](https://github.com/timeofmind/data-driven-framework-caddy2)
run it.

The point of the demonstration is the framework's **interactive grid**: the same
interface view that draws a calendar (a grid of days) draws a chess board (a grid of
`a`–`h` × `8`–`1`), and dragging a piece to a square writes the piece's `square` slot —
nothing more. Everything chess-like is in the model:

- a game **starts with** its 32 pieces (`starts_with`), each owned by one of the players;
- the pieces on a piece's square are a relationship **by matching slots** (`has_many` with
  `match`), whose `where` reads the moving piece as `self.*`; so are the pieces on the
  line of its move (`blockers`);
- the class's **checks** say what a legal move is, by counting those: whose turn it is,
  how each kind of piece moves, that the way is clear, what stands on the square;
- **triggers** do what follows an accepted move: the taken piece leaves the board
  (`via: victims`), a pawn on the last rank becomes a queen (`via: me`), the turn passes
  and taking the king ends the game (`via: game_id`).

Not described, as this is a demonstration: castling, en passant, check and checkmate.
See `docs/how-chess-works.md` for the player's view.

**Nothing of a game is written to a database.** `routing/chess.yaml` keeps games and
pieces in a *memory* listener: every node holds its own copy, fed by the change log
and replicated through the cluster, and rebuilt from the whole log when a node starts.
Only players (and sessions) are in a SQLite database the nodes share.

## Layout

```
app.yaml        the manifest: name, model and page globs, theme, sign-up, nav
model/          the data model (players; games and pieces, with the rules)
routing/        where the data lives: players in SQLite, games and pieces in memory
pages/          one file per page, with its interface views
theme/          layout.html (adds chess.css and chess.js) and static/: chess.css (the board's look),
                chess.js (move and attack hints on the framework's client library, dd.js)
Caddyfile       one node of two, mounted below /chess
deploy/         install.sh (runit services chess-n1 and chess-n2), nginx upstream and location
```

## Checks

```sh
make check      # validate the model and pages; load the whole app in the handler
make report     # which pages read and write each class and field
```

## Deploy

```sh
sudo deploy/install.sh        # build the handler, install the app, (re)start the service
```

Then add `deploy/nginx-chess.conf`'s upstream to `conf.d/` and its location to the
holmgren.ca server block, and reload nginx. Admin logins go in `/etc/chess/admins`
(not in this repository).

## UML

The handler draws the model and pages as diagrams at `/chess/uml`.
