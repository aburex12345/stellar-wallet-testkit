# Security Policy

## Supported versions

Until 1.0, only the latest published minor version receives security fixes.

## Reporting

Do not open a public issue for a suspected vulnerability. Use GitHub private vulnerability
reporting for `aburex12345/stellar-wallet-testkit`. If that is unavailable, contact the maintainer
through the email address on the GitHub profile and include “stellar-wallet-testkit security” in
the subject.

Include impact, affected version, reproduction, and suggested mitigation. Expect acknowledgement
within seven days and a status update within fourteen days. Please allow 90 days for coordinated
disclosure unless exploitation requires a faster release.

## Scope

Relevant reports include unsafe browser injection boundaries, accidental key material, signature
outputs that could be mistaken for valid signatures, XDR parser denial of service, dependency
compromise, and release integrity. This package intentionally creates fake test outputs; submitting
those to a network is unsupported rather than a vulnerability.
