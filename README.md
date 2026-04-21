# Personal Website

My personal site built with **Vite + TypeScript**, designed as an **interactive terminal** landing page with:

- **Articles**
- **Projects**

The UI is intentionally minimal: black background, CGA-style accent colors.

## Commands (homepage terminal)

The homepage is a toy terminal. Useful commands:

- `help`, `clear`, `date`, `pwd`, `tree`, `exit`, `whoami`
- `ls` / `ls -l` / `ls -lh` / `ls -a` (flags can combine)
- `cd`, `cat`, `view`

Use **Tab** for completion and **↑/↓** for history.

- **`cat [FILE]`** — Print **raw** file contents in the terminal (e.g. Markdown or HTML source).
- **`view [FILE]`** — Open the **formatted** page for articles, `profile.txt`, or project demos (full-page navigation).

## Reading pages (keyboard)

Pages opened with **`view`** load [`public/read-nav.js`](public/read-nav.js) for vim-like reading. Focus moves by **block** (paragraph, list, heading, etc.).

| Key | Action |
|-----|--------|
| `j` / `k` / `h` | Next / previous block (`h` same as `k`). **Count prefix:** e.g. `12j` (down 12 blocks), `3k` or `3h` (up 3) |
| Mouse wheel | If the highlighted block scrolls **fully** out of view: wheel **down** snaps highlight to the **first** visible block; wheel **up** snaps to the **last** visible block |
| `d` / `u` | Scroll half a page down / up (focus follows viewport center) |
| `g` then `g` | Top of page; highlight first block |
| `G` | Bottom of page; highlight last block |
| `z` then `z` | Center current block (`zz`) |
| `z` then `t` | Current block near top of viewport (`zt`) |
| `z` then `b` | Current block near bottom (`zb`) |
| `?` | Open keyboard help overlay (**Shift + /**) |
| `q` | With help **closed**: return to terminal home. With help **open**: close help only. |

You can also click **← close help** at the top of the help panel.

**Note:** In **vim**, `?` usually starts a **backward search**. On this site, `?` opens the **help overlay** (a web-reader convention). The help panel mentions this too.

When you leave the terminal via `view`, the session snapshot restores scrollback and shell history when you press `q` to return.
