# MexHome: Week of 2026-06-22

---

## 1. Executive Summary

- MexHome launched a major agent education initiative this week, adding 57 new URLs centered on an "Agent Resources" hub and a full "Masterclass for Agents" course with structured lesson modules spanning six sections.
- On the keyword side, MexHome recorded broad ranking gains across Mexico real estate terms, including beachfront property, Los Cabos, Puerto Vallarta, and Mexico City, with the site holding position 1 on several high-volume queries.
- Backlink movement was limited: one new link gained from FlexMLS (domain authority 88) and two links lost, one from a Canadian content site (DA 35) and one from a web directory (DA 65, nofollow).
- The properties and listing-type pages were updated this week, suggesting ongoing inventory or category maintenance alongside the new course content build-out.

---

## 2. New Pages Built by MexHome

MexHome published 57 new URLs between June 17 and June 22, 2026. The build is entirely focused on a new agent-facing education section. The structure breaks down as follows.

**Agent Resources hub and course landing page**

- `/agent-resources/` - Top-level hub for agent-facing content and resources.
- `/courses/masterclass-for-agents/` - Primary landing page for the Masterclass for Agents course.

**Masterclass lesson pages (under `/courses/masterclass-for-agents/lessons/`)**

These are the canonical, properly nested lesson URLs for the full course, organized across six modules.

- Module 1 (Personal Standards): welcome-introduction, 1-1-the-foundation-making-your-bed, 1-2-the-star-of-your-own-show-commanding-respect, 1-3-authenticity-as-a-business-tool-be-genuine, 1-4-humility-and-poise-dont-take-yourself-too-seriously, 1-5-the-pinnacle-of-self-respect-do-everything-with-grace, 1-6-executing-at-the-highest-level
- Module 2 (Infrastructure and Brand): 2-1-certification-the-professional-barrier-to-entry, 2-2-essential-infrastructure-the-things-you-should-have, 2-3-your-digital-hub-building-a-world-class-website, 2-4-the-brain-of-the-operation-using-a-crm-and-flex-mls, 2-5-the-agency-vs-building-your-own-brand, 2-6-the-power-of-your-origin-story
- Modules 3 through 6 (Client Relations, Legal/Finance, Marketing, and Business Growth): lessons covering strategic pricing and negotiation, the notario closing process, fideicomiso bank trust, non-resident financing, social media, networking, KPIs, and the agent-to-CEO transition (all suffixed with `-2`, indicating these are the course-nested versions of the lessons)

**Duplicate lesson paths under `/lessons/`**

A parallel set of lesson slugs was also published under the top-level `/lessons/` directory (e.g., `/lessons/lesson/`, `/lessons/lesson-2/`, and individual lesson slugs for modules 3 through 6). These appear to be staging or plugin-generated duplicates of the same content sitting under the `/courses/masterclass-for-agents/lessons/` path. This creates a crawl duplication risk that warrants attention.

**Signal:** MexHome is positioning itself as an educational authority for Mexico real estate agents, covering licensing, branding, CRM usage, the fideicomiso, notario process, and non-resident financing. This content does not target buyer search queries directly but builds topical authority and positions the platform as a B2B resource for agent recruitment and training.

---

## 3. Backlink Movements

| Source Domain | Source URL | Anchor Text | Domain Authority | Followed | New/Lost |
|---|---|---|---|---|---|
| mymobile.flexmls.com | https://mymobile.flexmls.com/mexhome1/accounts/20160217232827137695000000 | http://mexhome.com/ | 88 | Yes | New |
| retrocity.ca | https://retrocity.ca/2r7dh/mexico-houses-for-sale-zillow | Mexico Real Estate: Mexico Homes for Sale | MexHome | 35 | Yes | Lost |
| websitescrawl.com | http://www.websitescrawl.com/websites-list-240 | mexhome | 65 | No | Lost |

The new link from FlexMLS (DA 88) is a high-authority addition, though the source URL is a user-account page within the MLS platform rather than an editorial or directory placement, which limits its direct SEO value. The lost link from retrocity.ca (DA 35, followed) is the more consequential loss: it was a followed link with a keyword-rich anchor that has now gone to a 404. The lost websitescrawl.com link was nofollow and carries minimal practical impact.

---

## 4. Keyword and Ranking Changes

MexHome's position-change data covers 200 keyword movements this week. The overview data confirms 2,252 keywords moved up and 1,979 moved down across the full tracked set.

**Notable ranking gains**

Applying the location and service filter, the following qualifying gains are confirmed in the data. Keywords that are generic country-level terms without a named location or specific property service are excluded per filter rules.

| Keyword | Previous Position | Current Position | Change | Search Volume | Landing Page |
|---|---|---|---|---|---|
| mexico property for sale beachfront | 10 | 1 | +9 | 320 | / |
| beach property in mexico for sale | 8 | 1 | +7 | 320 | / |
| houses for sale in puerto vallarta mexico | 8 | 2 | +6 | 390 | /properties/ |
| los cabos real estate mexico | 2 | 1 | +1 | 590 | /area/los-cabos/ |
| san pancho nayarit real estate | 2 | 1 | +1 | 590 | /area/riviera-nayarit-real-estate/san-francisco-mexico/ |
| real estate san francisco nayarit mexico | 2 | 1 | +1 | 590 | /area/riviera-nayarit-real-estate/san-francisco-mexico/ |
| san francisco nayarit real estate | 2 | 1 | +1 | 590 | /area/riviera-nayarit-real-estate/san-francisco-mexico/ |
| properties for sale in mexico city | 2 | 1 | +1 | 590 | / |
| los cabos real estate | 3 | 2 | +1 | 590 | /area/los-cabos/ |
| los cabos property | 3 | 2 | +1 | 590 | /area/los-cabos/ |
| puerto vallarta apartments for sale | 2 | 1 | +1 | 320 | /properties/ |
| casas en venta en puerto vallarta | 3 | 2 | +1 | 590 | /es/area/puerto-vallarta/ |

The most significant gains are on beachfront property terms, where MexHome jumped from positions 8 and 10 to position 1 on "beach property in mexico for sale" and "mexico property for sale beachfront" respectively. The Los Cabos and San Francisco Nayarit area pages are consolidating top-two positions across multiple related queries, indicating strong topical clustering for those destinations. Puerto Vallarta gains appear on both the English properties page and the Spanish-language area page.

**Notable ranking declines**

No keyword and ranking decline data meeting the location- or service-specific filter threshold is present in the positions data payload provided this week. The overview confirms 1,979 keywords moved down in aggregate, but no individual decline rows are included in the `topRows` of the positions file.

No notable ranking declines this week.

---

## 5. Recommended Actions for MexHome

*These are combined recommended actions based on a review of all 8 competitor(s) monitored this week.*

1. Build a dedicated Amapas neighborhood guide for Puerto Vallarta. Proposed URL: `/blog/amapas-puerto-vallarta-neighborhood-guide/`. Confirmed this topic does not exist on MexHome's site. Trigger: Coldwell Banker La Costa Realty published bilingual 2026-dated neighborhood guides for Amapas and Centro this week, targeting buyers researching specific Puerto Vallarta neighborhoods before reaching a listings page. Why this fits MexHome: MexHome has a strong Puerto Vallarta area page and neighborhood-level listing pages for Amapas, but no editorial guide that matches buyer-intent searches like "living in Amapas Puerto Vallarta" or "Amapas neighborhood guide." A content page here fills a direct gap that a well-funded competitor just moved to claim.

2. Build a San Jose del Cabo condos for sale page optimized as a standalone destination. Proposed URL: `/area/los-cabos/san-jose-del-cabo/san-jose-del-cabo-condos-for-sale/`. Confirmed this exact page does not exist on MexHome's site (the existing page at `/area/los-cabos/san-jose-del-cabo/` is a general area page). Trigger: Remax jumped "san jose del cabo real estate" from position 18 to position 1 and swept every San Jose del Cabo condo keyword to rank 1 in a single week, all pointing to a dedicated properties page. Diamante Realtors and Cabo Real Estate also posted gains on San Jose del Cabo condo terms this week. Three competitors moving on the same query cluster in one week is a clear gap signal. Why this fits MexHome: MexHome already holds strong Los Cabos positions, including rank 1 on "los cabos real estate mexico." A purpose-built San Jose del Cabo condos page extends that authority into the sub-market where the most competitive movement happened this week.

3. Update the existing `/area/los-cabos/` page to strengthen beachfront and oceanfront property signals for Cabo San Lucas. Trigger: TopMexicoRealEstate reached position 1 on "mexico oceanfront real estate for sale" and "mexican beachfront property for sale" through a dedicated /oceanfront.php page, while Remax swept "beachfront condos for sale cabo san lucas" and related variants to rank 1. MexHome jumped to position 1 on "mexico property for sale beachfront" this week, showing the site can compete on these terms, but the signal is currently landing on the homepage rather than a location-specific page. Why this fits MexHome: Concentrating beachfront and oceanfront language within the Los Cabos area page, where MexHome already holds positions 1 and 2 on core Los Cabos terms, turns an existing authority asset into a more precise match for high-intent beachfront buyer searches in one of MexHome's primary destination markets.

4. Build a Centro neighborhood guide for Puerto Vallarta. Proposed URL: `/blog/centro-puerto-vallarta-neighborhood-guide/`. Confirmed this topic does not exist on MexHome's site. Trigger: Coldwell Banker La Costa Realty published this guide in both English and Spanish this week alongside the Amapas guide, treating Puerto Vallarta neighborhood editorial content as a coordinated campaign rather than a one-off post. Why this fits MexHome: MexHome has listing pages for Downtown Centro Puerto Vallarta but no buyer-facing editorial content explaining the neighborhood to expats and vacation home buyers who search "living in Centro Puerto Vallarta" or "Centro Puerto Vallarta real estate guide" before they reach a listings page. This is the same content gap as Amapas and warrants the same response.