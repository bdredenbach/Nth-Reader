# 1.0.0 release validation

Promoted from user-tested 0.38.13. The user reports completing feature and stress testing successfully.

Run `npm install` in this directory, then `npm test` for the 70 page-deck checks. From the repository root run `NODE_PATH=tests/node_modules node tests/release-tests.cjs` for the 174 release checks. Node tests simulate layout; the user completed Android visual and feature testing on the release candidate.

Production identity is `com.nthreader.app`; version name `1.0.0`, version code `10000`. Debug builds retain `.preview3812`. Signing keys are excluded from source.
