# Bruno collection for the partner API

Open this folder in Bruno, pick the `sandbox` environment, fill the variables, send. Every request that needs a signature signs itself
(`collection.bru`); `Open the launch URL` needs no signature.

## Secrets: read this first

- 🔴 **Use a personal, local workspace. Do not sync this collection or its environment to a cloud or shared workspace.**
- The safest setup: derive the channel keys yourself (see `contract/en/credential-derivation.md`) and set only `eventSecret`
  and `launchSecret` (secret variables). Each opens one channel.
- Convenience setup: set `masterSecret` and let the collection derive the channel keys. The master secret opens **every** channel,
  including `SETTLEMENT`. Use it only with a sandbox credential set, never with a production one.
- Never paste a secret into a request, a ticket or a chat.

## Variables

`baseUrl`, `accessKey`, `eventSecret` / `launchSecret` or `masterSecret`, `channelVersion` (default `1`), `eventType`, `externalUserId`,
`campaignId`, `eventSource`.

Run `Create a launch URL` before `Open the launch URL`: the first stores `launchUrl`. The URL works once.
