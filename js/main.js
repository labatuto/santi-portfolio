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
// INITIALIZATION
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
  loadGoodreads();
  loadWritingData();
});
