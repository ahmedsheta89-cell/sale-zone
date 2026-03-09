# Google Merchant Center Setup

## Feed URL
https://ahmedsheta89-cell.github.io/sale-zone/feed.xml

## Steps to connect

### 1. Create Google Merchant Center account
- Go to: https://merchants.google.com
- Sign in with a Google account
- Complete the business information

### 2. Verify website
- Go to: Business info -> Website
- Add: https://ahmedsheta89-cell.github.io/sale-zone
- Verify via HTML tag method
- Add the provided verification meta tag to the `<head>` of `????_2.HTML`

### 3. Add product feed
- Go to: Products -> Feeds -> Add feed
- Country: Egypt
- Language: Arabic
- Feed name: Sale Zone Feed
- Feed type: Scheduled fetch
- Feed URL: https://ahmedsheta89-cell.github.io/sale-zone/feed.xml
- Fetch frequency: Daily

### 4. Wait for approval
- Google reviews products within 3-5 business days
- Fix any disapproved products in Merchant Center

## Feed auto-updates
- Every push to `main` regenerates `feed.xml`
- Scheduled regeneration runs every 6 hours
- Manual run: GitHub Actions -> Generate Google Shopping Feed -> Run workflow
