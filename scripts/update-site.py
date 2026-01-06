#!/usr/bin/env python3
"""
Santi Ruiz Portfolio - Site Update Script

This single script handles all site updates:
- Refreshes Goodreads reading data
- Checks for new Statecraft articles
- Checks for new Free Beacon articles
- Extracts searchable keywords from new articles

Usage:
    python3 scripts/update-site.py              # Update everything
    python3 scripts/update-site.py --goodreads  # Only update Goodreads
    python3 scripts/update-site.py --articles   # Only check for new articles
"""

import json
import os
import re
import ssl
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from html import unescape
from datetime import datetime

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.join(SCRIPT_DIR, '..')
DATA_DIR = os.path.join(ROOT_DIR, 'data')
WRITING_JSON = os.path.join(DATA_DIR, 'writing.json')
GOODREADS_CACHE = os.path.join(DATA_DIR, 'goodreads-cache.json')
RSS_FEED = os.path.join(ROOT_DIR, 'feed.xml')

# Goodreads config
GOODREADS_USER_ID = '45140929-santi-ruiz'

# Articles to never add (blocklist patterns - case insensitive)
BLOCKED_TITLES = [
    'Experts Worry Biden FCC Pick Will Use Post To Attack Conservatives',
    'Blackburn Says YouTube Dinged Channel at Behest of CCP',
    'Microsoft Exec Says China Leads the World in Pandemic Response',
    'Blackburn Says Facebook Whistleblower',
    'Facebook, Instagram Suffer Widespread Outage',
    'GOP Congresswoman Asks Facebook To Explain Suspension of Gold Star Mother',
    'Twitter Automatically Recommends Users Follow Taliban Accounts',
    'Hispanic Groups Push Biden To Dump Progressive FCC Nominee',
    'Bezos \'Greases\' Way Into Dem Establishment',
    'Facebook Changes Name to \'Meta\'',
    'Chinese Propaganda Dominates Search Results for US Military Base',
    'Klobuchar Staffer Announces Apple Gig Hours After Senator Slams Big Tech Revolving Door',
    'Senators Slam Facebook for Adverse Effect on Teens',
    'Amazon Blocks Ad for Book Critical of Black Lives Matter',
    'Facebook Blocks Ad For Song Critical of Biden',
    'Gettr',
    'Biden Declares Cybersecurity \'Core National Security Challenge\'',
    'Experts Say Apple\'s Child Porn Detection Tool Is Less Accurate',
    'Critics Say Apple Keeps Its App Store Closed to Aid Chinese Censorship',
    'Facebook Oversight Board Punts on Trump Ban Decision',
    'Blackburn Calls Biden FTC Nominee \'Not Aggressive Enough\'',
    'Democrats Descend into Twitter War With Amazon',
    'Cruz Calls For Scrutiny of Platforms That Halted GameStop',
    'Day Traders Face Massive Pushback From Social Media',
    'Twitter Opens Floodgates to Public Moderation',
    'Lincoln Project\'s Tweets of Private DMs',
]

def is_blocked(title):
    """Check if a title matches any blocked pattern"""
    title_lower = title.lower()
    return any(pattern.lower() in title_lower for pattern in BLOCKED_TITLES)

def fetch(url, timeout=20):
    """Fetch a URL with SSL verification disabled (for RSS feeds)"""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    })
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=timeout) as r:
            return r.read().decode('utf-8', errors='ignore')
    except Exception as e:
        return None

def update_goodreads():
    """Update the Goodreads cache with current reading data"""
    print('\n📚 Updating Goodreads cache...')

    def parse_books(xml_content):
        if not xml_content:
            return []
        books = []
        try:
            root = ET.fromstring(xml_content)
            for item in root.findall('.//item'):
                title = item.find('title')
                author = item.find('author_name')
                link = item.find('link')
                image = item.find('book_image_url')

                title_text = title.text if title is not None else 'Unknown'
                title_text = re.sub(r'\s*\([^)]*\)\s*$', '', title_text)

                books.append({
                    'title': title_text,
                    'author': author.text if author is not None else '',
                    'link': link.text if link is not None else '#',
                    'imageUrl': image.text if image is not None else ''
                })
        except:
            pass
        return books

    current_url = f'https://www.goodreads.com/review/list_rss/{GOODREADS_USER_ID}?shelf=currently-reading'
    read_url = f'https://www.goodreads.com/review/list_rss/{GOODREADS_USER_ID}?shelf=read'

    current_books = parse_books(fetch(current_url))
    read_books = parse_books(fetch(read_url))

    if current_books or read_books:
        cache = {
            'currentBooks': current_books,
            'readBooks': read_books[:10],
            'timestamp': int(time.time() * 1000)
        }
        with open(GOODREADS_CACHE, 'w') as f:
            json.dump(cache, f, indent=2)
        print(f'   ✓ Currently reading: {len(current_books)} books')
        print(f'   ✓ Recently read: {len(read_books[:10])} books')
    else:
        print('   ✗ Could not fetch Goodreads data')

def extract_keywords(html, url):
    """Extract searchable content from an article page"""
    # For Substack (Statecraft), target the article body
    if 'statecraft.pub' in url or 'substack.com' in url:
        match = re.search(r'<div[^>]*class="[^"]*available-content[^"]*"[^>]*>(.*)', html, re.DOTALL)
        if match:
            content = match.group(1)
            for end_marker in ['<div class="subscription-widget', '<div class="footer', '<div class="post-footer']:
                end = content.find(end_marker)
                if end > 0:
                    content = content[:end]
                    break
            html = content

    # Remove scripts, styles, nav, footer
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL|re.I)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL|re.I)
    html = re.sub(r'<nav[^>]*>.*?</nav>', '', html, flags=re.DOTALL|re.I)
    html = re.sub(r'<footer[^>]*>.*?</footer>', '', html, flags=re.DOTALL|re.I)

    # Extract text from content tags
    parts = []
    for tag in ['p', 'h1', 'h2', 'h3', 'h4', 'li', 'blockquote']:
        for m in re.finditer(f'<{tag}[^>]*>(.*?)</{tag}>', html, re.DOTALL|re.I):
            t = re.sub(r'<[^>]+>', ' ', m.group(1))
            t = re.sub(r'\s+', ' ', unescape(t)).strip()
            if len(t) > 20:
                parts.append(t)

    text = ' '.join(parts)
    return text[:20000]  # Limit to 20KB per article

def get_date(html):
    """Extract publication date from article HTML"""
    m = re.search(r'"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})', html)
    if m: return m.group(1)
    m = re.search(r'<time[^>]*datetime="(\d{4}-\d{2}-\d{2})', html)
    if m: return m.group(1)
    return datetime.now().strftime('%Y-%m-%d')

def check_statecraft():
    """Check for new Statecraft articles from sitemaps"""
    print('\n📝 Checking Statecraft for new articles...')

    with open(WRITING_JSON) as f:
        articles = json.load(f)
    existing_urls = {a['url'] for a in articles}

    new_articles = []
    for year in ['2024', '2025', '2026']:
        html = fetch(f'https://www.statecraft.pub/sitemap/{year}')
        if not html:
            continue

        for m in re.finditer(r'href="(https://www\.statecraft\.pub/p/[^"]+)"[^>]*>([^<]+)<', html):
            url, title = m.groups()
            if '/comments' in url or url in existing_urls:
                continue

            print(f'   Found new: {title[:50]}...')
            page = fetch(url)
            if page:
                new_articles.append({
                    'title': unescape(title.strip()),
                    'publication': 'Statecraft',
                    'date': get_date(page),
                    'url': url,
                    'keywords': extract_keywords(page, url)
                })
                existing_urls.add(url)
            time.sleep(0.2)

    return new_articles

def check_freebeacon():
    """Check for new Free Beacon articles from author RSS"""
    print('\n📰 Checking Free Beacon for new articles...')

    with open(WRITING_JSON) as f:
        articles = json.load(f)
    existing_urls = {a['url'] for a in articles}

    new_articles = []

    # Check RSS feed pages
    for page_num in range(1, 10):
        url = f'https://freebeacon.com/author/santi-ruiz/feed/' if page_num == 1 else f'https://freebeacon.com/author/santi-ruiz/feed/?paged={page_num}'
        xml = fetch(url)
        if not xml or '<item>' not in xml:
            break

        for m in re.finditer(r'<item>.*?<title>(?:<!\[CDATA\[)?([^<\]]+)(?:\]\]>)?</title>.*?<link>([^<]+)</link>', xml, re.DOTALL):
            title, article_url = m.groups()
            if article_url in existing_urls:
                continue
            if is_blocked(title):
                continue

            print(f'   Found new: {title[:50]}...')
            page = fetch(article_url)
            if page:
                new_articles.append({
                    'title': unescape(title.strip()),
                    'publication': 'Washington Free Beacon',
                    'date': get_date(page),
                    'url': article_url,
                    'keywords': extract_keywords(page, article_url)
                })
                existing_urls.add(article_url)
            time.sleep(0.2)

    return new_articles

def update_articles():
    """Check all sources for new articles and update writing.json"""
    with open(WRITING_JSON) as f:
        articles = json.load(f)

    initial_count = len(articles)

    # Check sources
    new_statecraft = check_statecraft()
    new_freebeacon = check_freebeacon()

    all_new = new_statecraft + new_freebeacon

    if all_new:
        articles.extend(all_new)

        # Sort by date and dedupe
        articles.sort(key=lambda x: x['date'], reverse=True)
        seen = set()
        unique = []
        for a in articles:
            if a['url'] not in seen:
                seen.add(a['url'])
                unique.append(a)

        with open(WRITING_JSON, 'w') as f:
            json.dump(unique, f, indent=2)

        print(f'\n✓ Added {len(all_new)} new articles')
        print(f'  Total: {len(unique)} articles')
    else:
        print('\n✓ No new articles found')

def regenerate_rss():
    """Regenerate the RSS feed from writing.json"""
    print('\n📡 Regenerating RSS feed...')

    import html as html_module

    with open(WRITING_JSON) as f:
        articles = json.load(f)

    articles.sort(key=lambda x: x['date'], reverse=True)

    build_date = datetime.now().strftime('%a, %d %b %Y %H:%M:%S +0000')

    rss = f'''<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Santi Ruiz - Selected Work</title>
  <link>https://labatuto.github.io/santi-portfolio/</link>
  <description>Writing and interviews by Santi Ruiz</description>
  <language>en-us</language>
  <lastBuildDate>{build_date}</lastBuildDate>
  <atom:link href="https://labatuto.github.io/santi-portfolio/feed.xml" rel="self" type="application/rss+xml"/>
'''

    for article in articles[:50]:
        pub_date = datetime.strptime(article['date'], '%Y-%m-%d').strftime('%a, %d %b %Y 00:00:00 +0000')
        title = html_module.escape(article['title'])
        description = html_module.escape(f"Published in {article['publication']}")

        rss += f'''  <item>
    <title>{title}</title>
    <link>{article['url']}</link>
    <description>{description}</description>
    <pubDate>{pub_date}</pubDate>
    <guid isPermaLink="true">{article['url']}</guid>
  </item>
'''

    rss += '''</channel>
</rss>'''

    with open(RSS_FEED, 'w') as f:
        f.write(rss)

    print(f'   ✓ RSS feed updated with {min(50, len(articles))} items')

def main():
    args = sys.argv[1:]

    print('=' * 50)
    print('Santi Ruiz Portfolio - Site Update')
    print('=' * 50)

    if not args or '--goodreads' in args:
        update_goodreads()

    if not args or '--articles' in args:
        update_articles()

    # Always regenerate RSS
    regenerate_rss()

    print('\n✓ Done!')
    print('=' * 50)

if __name__ == '__main__':
    main()
