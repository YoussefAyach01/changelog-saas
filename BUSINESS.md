# Journal: business one-pager

## Buyer and problem

Small SaaS teams, indie hackers and agencies shipping client apps in Morocco and francophone markets. They ship
weekly but customers never hear about it (release notes live in WhatsApp groups or nowhere). Headway, Beamer and
LaunchNotes are English-first and cost 30-250 USD/month. Journal gives them a public changelog, RSS and an in-app
"Nouveautés" badge in French/Arabic for the price of a coffee.

## Pricing

| Plan           | MAD                      | USD             | Includes                                                                  |
| -------------- | ------------------------ | --------------- | ------------------------------------------------------------------------- |
| Gratuit        | 0                        | 0               | 1 project, unlimited entries, public page, RSS, widget                    |
| Pro            | 59 / month or 590 / year | about 6 / month | unlimited projects (later: custom domain, email subscribers, no branding) |
| Agence (later) | 199 / month              | about 20        | many client projects + white-label                                        |

## First 5 customers

1. Agencies and freelancers who deliver web apps to clients: pitch Journal as a "monthly update page" deliverable they can bill
   for; onboard 3 of their client projects for free.
2. Moroccan indie hackers / SaaS founders on Twitter/X, LinkedIn and dev Discords: post the widget badge lighting up on a real
   product and offer lifetime Pro to the first 5.
3. Dogfood: publish the changelogs of your own projects (ci-pulse, Tuile, Retour) on Journal and link "Powered by Journal"
   from each; show them in your portfolio.

## Accounts needed to go live

Domain, VPS or Fly.io with a persistent volume, a payment route (Stripe needs a non-Moroccan entity; otherwise manual bank/cash-plus at first),
and an email provider (Resend) if you add subscriber emails.

## Honest limits

- Crowded market with well-funded competitors; the edge is price, locale and one-line setup.
- No email subscribers yet (RSS only), which is the feature customers of a changelog tool most often expect.
- No images/attachments in entries; Markdown subset only.
- Widget badge state is per browser (localStorage), not per logged-in user.
- Single-process in-memory rate limiting; needs Redis for multiple instances.
