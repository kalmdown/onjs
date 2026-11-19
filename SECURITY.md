# Credentials and local development

Never commit actual credentials, authorization headers, browser cookies, private keys, or AI conversation exports. `.gitignore` does not protect files already tracked by Git. Do not paste secrets into agent chats or use commands that print resolved environment variables.

## 1Password

Use the 1Password SSH agent for GitHub Git operations. Keep its private SSH key inside 1Password, register only the public key with GitHub, and use the SSH remote `git@github.com:kalmdown/onjs.git`. SSH authentication does not replace Onshape API credentials.

For API credentials, install the 1Password CLI, enable its desktop-app integration, and create a dedicated vault/item for this project with only the permissions it needs. Copy `.env.1password.example` to `.env.1password` (ignored). Replace its example references with references copied from your 1Password item. This file must contain only `op://` references and non-secret configuration.

Run:

```sh
op run --env-file=.env.1password -- npm start
```

Do not use `op read` into a terminal or write resolved secrets into `.env`. Environment variables remain accessible to the application and potentially other processes under your user account. Start only trusted code with injected credentials.

## Before committing

Install Gitleaks, then enable the included hook for this checkout:

```sh
git config core.hooksPath .githooks
gitleaks git --redact=100 --log-opts=--all .
```

The hook refuses to commit when Gitleaks is unavailable or detects a staged secret. Enable GitHub secret scanning and push protection in repository security settings as well. Scanners can miss secrets; review staged filenames and diffs before committing.

## Rotation after exposure

Delete exposed Onshape API key pairs in My account > Developer > API keys. Regenerate the OAuth application's client secret (or delete the unused app), revoke old application grants/tokens where supported, and review account API usage and documents for unexpected changes. API keys and OAuth credentials are separate.

Replace an exposed session secret with a fresh cryptographically random value when restarting the application; discard old sessions. Replace any deployed certificate using an exposed private key. Generate fresh localhost development certificates if needed; never reuse the committed key.

History removal does not revoke secrets. Coordinate history replacement with collaborators, re-clone afterward, and avoid reintroducing old branches. Cached commit views, pull-request refs, and forks can retain old data; follow GitHub's sensitive-data removal guidance and contact GitHub Support where applicable.
