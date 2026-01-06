# Technical Documentation: Santi Ruiz Personal Website

*This file is for future developers, not for the client.*

## Technology Stack

**Approach:** Static HTML/CSS/JavaScript
- No build tools or frameworks required
- Maximum simplicity and maintainability
- Fast loading, easy to host anywhere
- Can be migrated to a framework later if needed

**Why not React/Next.js/etc:**
- Overkill for a personal site with ~5 pages
- Adds complexity without meaningful benefit
- Harder for future maintainers to modify
- Static files are faster and more reliable

## File Structure

```
portfolio/
├── index.html          # Homepage with bio, photo, roles
├── writing.html        # Complete writing archive
├── css/
│   └── styles.css      # All styles
├── js/
│   └── main.js         # Interactions, Goodreads integration
├── assets/
│   ├── headshot.jpg    # Profile photo
│   └── ...             # Any other images
├── CLAUDE.md           # Project guide (client-facing context)
└── TECHNICAL.md        # This file
```

## Design System

### Colors
Based on client's aesthetic references (Americana, Art Deco, warm tones):

```css
:root {
  --bg-primary: #F5F0E6;      /* Warm cream background */
  --bg-secondary: #EDE6D6;    /* Slightly darker cream for sections */
  --text-primary: #2C2C2C;    /* Near-black for body text */
  --text-secondary: #5C5C5C;  /* Gray for secondary text */
  --accent: #1E3A5F;          /* Deep navy blue for links/accents */
  --accent-hover: #2C5282;    /* Lighter blue on hover */
  --accent-warm: #B8860B;     /* Goldenrod for subtle highlights */
}
```

### Typography
Art Deco influenced but understated:

- **Headings:** Geometric sans-serif (e.g., Futura, Josefin Sans, or similar Google Font)
- **Body:** Clean serif for readability (e.g., Source Serif Pro, Crimson Text)
- **Clear hierarchy:** Large headlines, comfortable body size, generous line height

### Spacing
- Generous whitespace
- Clear section separation
- Mobile-first responsive design

## Features

### 1. Static Content
- Bio, photo, roles: Simple HTML
- Contact info and links: Simple HTML with mailto/external links

### 2. Writing Archive
- Static list generated from comprehensive research
- Format: Title | Date | Publication
- Reverse chronological order
- Links to original articles
- Consider: Filter/search functionality if list gets long

### 3. Goodreads Integration
Options (in order of preference):

**Option A: Manual updates**
- Client updates a simple JSON file with current reads
- Most reliable, no API dependencies
- Recommendation: Start here

**Option B: Goodreads RSS feed**
- Goodreads provides RSS feeds for shelves
- Parse client-side with JavaScript
- May have CORS issues, need proxy or serverless function

**Option C: Third-party widget**
- Services like goodreads-widget exist
- Less control over styling
- Dependency on third party

## Interactions

### Hover Effects
- Links: Subtle color transition + optional underline animation
- Keep transitions fast (150-200ms)
- Don't overdo it - understated is the goal

### Mobile
- Hamburger menu for navigation
- Stack sections vertically
- Maintain readability on small screens

## Hosting Recommendations

**Simple options:**
1. GitHub Pages (free, reliable)
2. Netlify (free tier, easy deploys)
3. Vercel (free tier)

**Custom domain:**
- Client will need to purchase domain (e.g., santiruiz.com)
- DNS configuration straightforward with any of the above hosts

## Future Considerations

- If site grows, consider migrating to Astro or 11ty for better content management
- If writing archive becomes very long, add search/filter
- Could add dark mode toggle later (like Andy Masley's site)

## Development Notes

- Test on mobile devices before showing client
- Validate all external links in writing archive
- Optimize images (compress headshot)
- Check accessibility (contrast ratios, alt text, keyboard navigation)
