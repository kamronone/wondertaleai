# WonderTale AI — Legal release blockers (Uzbekistan)

Date of draft: 20 November 2026. Scope: frontend legal copy only in `fix/private-book-access`. No production release and no representation that the service is compliant.

## Implemented in branch

- `frontend/src/LegalCenter.tsx`: RU, UZ and EN draft terms, privacy, copyright and parent/child safety notices.
- Navigable legal links in the footer, with `#legal/terms`, `#legal/privacy`, `#legal/copyright`, `#legal/parents` links.
- Separate checkboxes in the story creation step for adult representation/consent and having read terms and privacy, neither preselected.
- The UI returns to the creation step after a legal document is viewed, preserving the draft.
- No charge, paid subscription, merchant agreement, payment processing or backend change was enabled.

## MUST complete before operating or collecting children's data at scale

1. **Confirm the legal operator:** full real name / business form (individual entrepreneur or registered company as applicable), registered business details, mailing address, working contact for data/privacy/copyright complaints. `kamronone` is a project attribution, not a registered operator name.
2. **Audit actual data processing:** what parent and child data are processed, location of databases, vendor contracts, hosting, backups, subprocessors, technical access, cross-border transfers, logs, data lifecycle and retention. The draft must be updated with verified facts, not assumptions.
3. **Validate the 2026 version of Uzbekistan Personal Data Act ZRU-547**, particularly consent for a minor, data subject rights, and data-localization categories after amendment ZRU-1125 (26 March 2026). Determine whether database registration is mandatory for actual categories of data. Obtain legal counsel before using foreign hosting for regulated classes.
4. **Create a legally sufficient guardian-consent workflow** for collection/processing of children's personal data. A checkbox in React is a UI acknowledgment and not automatically an appropriately signed electronic document or verifiable representation. Implement the legally appropriate evidence/withdrawal/renewal process only after authorized Backend work.
5. **Verify independent copyright permissions:** rights/license for every custom image, icon, background, soundtrack, font, translation and adaptation; confirm story classics are public domain in the relevant form and country. Do not imply authorship over content not actually owned, and do not promise exclusive rights in AI outputs.
6. **Publish the real point of contact** and a practical correction/deletion/consent withdrawal process. Verify that book removal clears backend and queued/offline data as promised.
7. **Explain AI provider processing accurately:** which vendor receives prompts, contract/data usage and retention, moderation, and whether information is transmitted outside Uzbekistan. The current UI intentionally rejects child photos for the AI generator; do not activate photos without a separate assessment.
8. **Commercial legal setup:** before accepting money, confirm trading eligibility/registration and publish seller identity, product/service scope, prices/taxes, payment methods, cancellation/subscription renewal, refunds and complaint handling. Review Electronic Commerce Act ZRU-792 and Consumer Protection Act 221-I.
9. **Version and evidence:** obtain legal review of final documents; publish effective dates, old versions and appropriate evidence of consent and updates. The current draft displays its preparation date, not a legally approved effective date.
10. **Operational validation:** review authentication, user isolation, cookie/session management, PWA cache rules, emergency contact and security handling. A passing Backend CI run is not a deployed multi-account security audit; keep public release blocked until real-environment access tests and legal review pass.

## Authoritative primary sources

- Personal Data Act ZRU-547: https://lex.uz/ru/docs/4396428
- Amendment ZRU-1125, 26 March 2026: https://lex.uz/ru/docs/8104580
- Copyright and Related Rights Act ZRU-42: https://lex.uz/ru/acts/1023494
- Consumer Protection Act 221-I: https://lex.uz/ru/acts/14643
- Electronic Commerce Act ZRU-792: https://lex.uz/ru/docs/6213428

This is a preparation checklist, not legal advice and not a certification of compliance.
