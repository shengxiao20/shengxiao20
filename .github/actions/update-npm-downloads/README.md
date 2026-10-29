# npm download updater

For the GitHub profile, open **Actions → Update npm downloads → Run workflow**
and select `main`. The workflow updates `README.md` and commits it to `main`,
which publishes the profile immediately.

The personal website uses this composite action with `target: website` and
performs its own commit and GitHub Pages deployment.

```yaml
- uses: shengxiao20/shengxiao20/.github/actions/update-npm-downloads@main
  with:
    target: website
```

## Statistics contract

- Packages come from the existing npm table rows in the profile or the
  `data-npm-downloads` attributes in the website, not from a separate package list.
- Totals cover npm's available history from 2015-01-10 through UTC yesterday.
- Requests use inclusive, contiguous ranges of at most 365 days.
- Invalid content, incomplete date ranges, invalid counts, timeouts, and API
  errors throw before the content file is written.
- No npm credentials or custom GitHub secrets are required.
- Every manual workflow run records a commit, even if the totals are unchanged.

## Local checks

```sh
node --test .github/actions/update-npm-downloads/update.test.mjs
node .github/actions/update-npm-downloads/update.mjs "$PWD" profile
```

Both formats require exactly one date-note marker:

```html
<!-- npm-downloads-updated:start -->Statistics cutoff text<!-- npm-downloads-updated:end -->
```
