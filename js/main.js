// ===========================================
// Santi Ruiz - Personal Website
// ===========================================

// Global state
let WRITING_DATA = [];
let PUBLICATIONS = [];
let selectedFilters = new Set();
let currentSearch = '';

// ===========================================
// GOODREADS FUNCTIONS
// ===========================================

const GOODREADS_USER_ID = '45140929-santi-ruiz';
const CORS_PROXIES = [
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`
];
const CACHE_KEY = 'goodreads_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

async function loadGoodreads() {
  // Try cache first
  const cached = getCachedGoodreads();
  if (cached) {
    displayGoodreadsData(cached);
    return;
  }

  // Try static fallback data first (most reliable)
  try {
    const response = await fetch('data/goodreads-cache.json');
    if (response.ok) {
      const data = await response.json();
      displayGoodreadsData(data);
      // Try to refresh in background
      refreshGoodreadsInBackground();
      return;
    }
  } catch (e) {
    // Continue to live fetch
  }

  // Try live fetch
  await fetchGoodreadsLive();
}

async function refreshGoodreadsInBackground() {
  try {
    await fetchGoodreadsLive();
  } catch (e) {
    // Silent fail - we already have fallback data displayed
  }
}

async function fetchGoodreadsLive() {
  const currentlyReadingUrl = `https://www.goodreads.com/review/list_rss/${GOODREADS_USER_ID}?shelf=currently-reading`;
  const readUrl = `https://www.goodreads.com/review/list_rss/${GOODREADS_USER_ID}?shelf=read`;

  let currentBooks = [];
  let readBooks = [];

  // Try each proxy
  for (const proxyFn of CORS_PROXIES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const [currentResponse, readResponse] = await Promise.all([
        fetch(proxyFn(currentlyReadingUrl), { signal: controller.signal }),
        fetch(proxyFn(readUrl), { signal: controller.signal })
      ]);

      clearTimeout(timeout);

      if (currentResponse.ok) {
        const currentXml = await currentResponse.text();
        currentBooks = parseGoodreadsRSS(currentXml);
      }

      if (readResponse.ok) {
        const readXml = await readResponse.text();
        readBooks = parseGoodreadsRSS(readXml);
      }

      if (currentBooks.length > 0 || readBooks.length > 0) {
        break; // Success, stop trying proxies
      }
    } catch (e) {
      continue; // Try next proxy
    }
  }

  if (currentBooks.length > 0 || readBooks.length > 0) {
    const data = { currentBooks, readBooks, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    displayGoodreadsData(data);
  } else {
    displayFallbackBooks();
  }
}

function getCachedGoodreads() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    if (Date.now() - data.timestamp > CACHE_DURATION) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function displayGoodreadsData(data) {
  const { currentBooks, readBooks } = data;

  if (currentBooks && currentBooks.length > 0) {
    const randomIndex = Math.floor(Math.random() * currentBooks.length);
    displayCurrentBook(currentBooks[randomIndex]);
  }

  if (readBooks && readBooks.length > 0) {
    displayRecentBooks(readBooks.slice(0, 3));
  }
}

function parseGoodreadsRSS(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const items = doc.querySelectorAll('item');

  const books = [];
  items.forEach(item => {
    const title = item.querySelector('title')?.textContent || 'Unknown Title';
    const author = item.querySelector('author_name')?.textContent || '';
    const link = item.querySelector('link')?.textContent || '#';
    const imageUrl = item.querySelector('book_image_url')?.textContent || '';
    const cleanTitle = title.replace(/\s*\([^)]*\)\s*$/, '');
    books.push({ title: cleanTitle, author, link, imageUrl });
  });

  return books;
}

function displayCurrentBook(book) {
  const container = document.getElementById('current-book');
  if (!container) return;

  // Get larger image from Goodreads by replacing size suffix
  let largeImageUrl = book.imageUrl;
  if (largeImageUrl) {
    largeImageUrl = largeImageUrl.replace(/\._S[XY]\d+_\./, '._SY200_.');
  }

  const coverHtml = largeImageUrl
    ? `<div class="current-book-cover"><img src="${largeImageUrl}" alt="${book.title}"></div>`
    : '';

  container.innerHTML = `
    <div class="book current-book-display">
      ${coverHtml}
      <div class="book-info">
        <a href="${book.link}" target="_blank" class="book-title">${book.title}</a>
        <span class="book-author">${book.author}</span>
      </div>
    </div>
  `;
}

function displayRecentBooks(books) {
  const container = document.getElementById('recent-books');
  if (!container) return;

  if (books.length === 0) {
    container.innerHTML = '<li>No recent books</li>';
    return;
  }

  container.innerHTML = books.map(book =>
    `<li>
      <a href="${book.link}" target="_blank">${book.title}</a>
      <span class="book-author">${book.author}</span>
    </li>`
  ).join('');
}

function displayFallbackBooks() {
  const currentContainer = document.getElementById('current-book');
  const recentContainer = document.getElementById('recent-books');

  if (currentContainer) {
    currentContainer.innerHTML = `
      <div class="book">
        <div class="book-info">
          <a href="https://www.goodreads.com/user/show/45140929-santi-ruiz" class="book-title">Visit Goodreads</a>
        </div>
      </div>
    `;
  }

  if (recentContainer) {
    recentContainer.innerHTML = '<li><a href="https://www.goodreads.com/user/show/45140929-santi-ruiz">See reading list →</a></li>';
  }
}

// ===========================================
// WRITING ARCHIVE FUNCTIONS
// ===========================================

async function loadWritingData() {
  try {
    const response = await fetch('data/writing.json');
    if (!response.ok) throw new Error('Failed to load');
    WRITING_DATA = await response.json();

    // Extract unique publications
    const pubs = new Set(WRITING_DATA.map(a => a.publication));
    PUBLICATIONS = Array.from(pubs).sort();

    setupFilters();
    setupSearch();
    displayWritingArchive();
  } catch (error) {
    console.error('Error loading writing data:', error);
    const container = document.getElementById('writing-list');
    if (container) {
      container.innerHTML = '<li class="no-results">Error loading articles</li>';
    }
  }
}

function displayWritingArchive() {
  const container = document.getElementById('writing-list');
  if (!container) return;

  let filtered = [...WRITING_DATA];

  if (selectedFilters.size > 0) {
    filtered = filtered.filter(a => selectedFilters.has(a.publication));
  }

  if (currentSearch) {
    const search = currentSearch.toLowerCase();
    filtered = filtered.filter(a =>
      a.title.toLowerCase().includes(search) ||
      a.publication.toLowerCase().includes(search) ||
      (a.keywords && a.keywords.toLowerCase().includes(search))
    );
  }

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    container.innerHTML = '<li class="no-results">No articles found</li>';
    return;
  }

  container.innerHTML = filtered.map(article => `
    <li>
      <a href="${article.url}" target="_blank">${article.title}</a>
      <span class="meta"><em>${article.publication}</em> · ${formatDate(article.date)}</span>
    </li>
  `).join('');
}

function setupFilters() {
  const filterContainer = document.getElementById('writing-filters');
  const filterToggle = document.getElementById('filter-toggle');
  const filterMenu = document.getElementById('filter-menu');
  const filterCount = filterToggle?.querySelector('.filter-count');

  if (!filterContainer || !filterToggle || !filterMenu) return;

  let html = '';
  PUBLICATIONS.forEach(pub => {
    html += `<label><input type="checkbox" value="${pub}"> <em>${pub}</em></label>`;
  });
  filterContainer.innerHTML = html;

  filterToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    filterMenu.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!filterMenu.contains(e.target) && e.target !== filterToggle) {
      filterMenu.classList.remove('open');
    }
  });

  filterContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedFilters.add(checkbox.value);
      } else {
        selectedFilters.delete(checkbox.value);
      }
      if (filterCount) {
        filterCount.textContent = selectedFilters.size > 0 ? selectedFilters.size : '';
      }
      displayWritingArchive();
    });
  });
}

function setupSearch() {
  const searchInput = document.getElementById('writing-search');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value;
    displayWritingArchive();
  });
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

// ===========================================
// FEATURED WORK FUNCTIONS
// ===========================================

const FEATURED_ARTICLES = [
  {
    title: 'The Ezra Klein Show: Santi Ruiz',
    publication: 'New York Times',
    url: 'https://www.nytimes.com/2025/03/25/opinion/ezra-klein-podcast-santi-ruiz.html',
    image: 'https://image.simplecastcdn.com/images/47913775-afcf-4643-935f-31f1dcc86cfb/6a0e5e15-04a3-47c8-9c50-2f2fe8e84437/3000x3000/teks-album-20art-3000px.jpg'
  },
  {
    title: 'Technocapital Is Eating My Brains',
    publication: 'Regress Studies',
    url: 'https://regressstudies.substack.com/p/technocapital-is-eating-my-brains',
    image: 'https://substack-post-media.s3.amazonaws.com/public/images/697952d0-d4e1-478b-a467-5f20874457f6_2455x2951.jpeg'
  },
  {
    title: 'Better Living Through Group Chemistry',
    publication: 'Asterisk',
    url: 'https://asteriskmag.com/issues/06/better-living-through-group-chemistry',
    image: 'https://asteriskmag.com/media/pages/issues/06/8d32f17406-1712585107/issue_06_cover_web-1200x630-crop.jpg'
  },
  {
    title: 'Bring Back the Bison',
    publication: 'National Review',
    url: 'https://www.nationalreview.com/2020/09/bring-back-the-bison/',
    image: 'https://i0.wp.com/www.nationalreview.com/wp-content/uploads/2020/09/bison-wyoming.jpg?fit=2057%2C1200&ssl=1'
  },
  {
    title: 'Intermission at the Ministry of Truth',
    publication: 'Pirate Wires',
    url: 'https://www.piratewires.com/p/intermission-at-the-ministry-of-truth',
    image: 'https://substack-post-media.s3.amazonaws.com/public/images/8af910ad-4e10-479d-95c2-ce3e7239ccd9_1280x720.jpeg'
  },
  {
    title: 'How to Stage a Coup',
    publication: 'Statecraft',
    url: 'https://www.statecraft.pub/p/how-to-commit-a-coup',
    image: 'https://substack-video.s3.amazonaws.com/video_upload/post/152873301/bd23e29e-e434-4a53-9562-cbd7c45d7466/transcoded-1733854297.png'
  },
  {
    title: 'How to Stop Losing 17,500 Kidneys',
    publication: 'Statecraft',
    url: 'https://www.statecraft.pub/p/how-to-stop-losing-17500-kidneys',
    image: 'https://substack-post-media.s3.amazonaws.com/public/images/3909aacc-6ecc-4a74-b8a9-8b676d8fb0ed_720x538.jpeg'
  },
  {
    title: 'How to Save DC\'s Metro',
    publication: 'Statecraft',
    url: 'https://www.statecraft.pub/p/how-to-save-dcs-metro',
    image: 'https://substack-video.s3.amazonaws.com/video_upload/post/165221347/b541c9df-ebd8-427b-b837-81c26cf91981/transcoded-1749070293.png'
  },
  {
    title: 'Land Back!',
    publication: 'Washington Free Beacon',
    url: 'https://freebeacon.com/culture/land-back/',
    image: 'https://freebeacon.com/wp-content/uploads/2021/05/Screen-Shot-2021-05-21-at-12.38.52-PM-e1621615157631.png'
  },
  {
    title: 'Should You Watch People Die',
    publication: 'Regress Studies',
    url: 'https://regressstudies.substack.com/p/should-you-watch-people-die',
    image: 'https://substack-post-media.s3.amazonaws.com/public/images/95e768da-ec7f-4942-bd42-cbed80ed5ddf_600x400.jpeg'
  },
  {
    title: 'Connection Failure',
    publication: 'Washington Free Beacon',
    url: 'https://freebeacon.com/culture/connection-failure/',
    image: 'https://freebeacon.com/wp-content/uploads/2021/08/GettyImages-944480656_736x514.jpg'
  },
  {
    title: 'The Five Things President Trump Should Do on Day One',
    publication: 'The Free Press',
    url: 'https://www.thefp.com/p/the-five-things-president-trump-should-do',
    image: 'https://substack-post-media.s3.amazonaws.com/public/images/305ed790-5f16-4a23-9254-00d0bf4818d6_1024x688.jpeg'
  }
];

// DOGE articles are always shown together
const DOGE_PAIR = [
  {
    title: '50 Thoughts on DOGE',
    publication: 'Statecraft',
    url: 'https://www.statecraft.pub/p/50-thoughts-on-doge',
    image: 'https://substack-video.s3.amazonaws.com/video_upload/post/158517661/3cbdbd17-4621-4a09-ade8-3dbcc39bba1e/transcoded-1741357522.png'
  },
  {
    title: 'More (Brief) Thoughts On DOGE',
    publication: 'Statecraft',
    url: 'https://www.statecraft.pub/p/more-brief-thoughts-on-doge',
    image: 'https://substack-post-media.s3.amazonaws.com/public/images/330a6d56-63f9-4b3e-bc65-a845c931c159_299x168.jpeg'
  }
];

function loadFeaturedWork() {
  const container = document.getElementById('featured-work');
  if (!container) return;

  // Shuffle and pick articles
  const shuffled = [...FEATURED_ARTICLES].sort(() => Math.random() - 0.5);

  // Randomly decide if DOGE pair is included (50% chance)
  const includeDoge = Math.random() < 0.5;

  let selected = [];
  if (includeDoge) {
    // Show DOGE pair + 1 other article
    selected = [...DOGE_PAIR, shuffled[0]];
  } else {
    // Show 3 random articles
    selected = shuffled.slice(0, 3);
  }

  container.innerHTML = selected.map(article => `
    <li class="featured-item">
      <a href="${article.url}" target="_blank" class="featured-link">
        <img src="${article.image}" alt="" class="featured-image" onerror="this.style.display='none'">
        <div class="featured-text">
          <span class="featured-title">${article.title}</span>
          <span class="featured-meta"><em>${article.publication}</em></span>
        </div>
      </a>
    </li>
  `).join('');
}

// ===========================================
// INITIALIZATION
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
  loadFeaturedWork();
  loadGoodreads();
  loadWritingData();
});
