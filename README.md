# linkding for Safari

A Safari Web Extension for saving and searching bookmarks in a self-hosted
[linkding](https://github.com/sissbruecker/linkding) instance.

This project is built for the open source
[linkding](https://github.com/sissbruecker/linkding) bookmark manager and uses
linkding's upstream logo assets from
[`assets/`](https://github.com/sissbruecker/linkding/tree/master/assets).

## Features

- Save the current Safari tab to linkding from the toolbar popup.
- After saving, open the bookmark in linkding to edit details such as tags or notes.
- Configure server URL, API token, default tags, unread, archive, and sharing defaults.
- Detect whether the current page is already bookmarked using linkding's `/api/bookmarks/check/` endpoint.
- Save pages from the context menu.
- Save from Safari's toolbar action shortcut, suggested as `Alt+Shift+D`.
- Search bookmarks with `Alt+Shift+F`.
- Search bookmarks from compatible browsers' address bars with the `ld` keyword.

## Setup

1. Run the macOS host app once.
2. Enable the extension in Safari Settings > Extensions.
3. Open the extension settings and enter your linkding server URL and API token.

The API token is available from the linkding Settings page and is sent as
`Authorization: Token <token>`.
