(function () {
  var modal = document.getElementById("search-modal");
  var input = document.getElementById("search-input");
  var resultsEl = document.getElementById("search-results");
  var root = document.documentElement.dataset.root || ".";
  var index = null;
  var activeIdx = -1;
  var timer;

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // --- Modal control ---

  function openSearch() {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    input.focus();
    if (!index) loadIndex();
  }

  function closeSearch() {
    modal.hidden = true;
    document.body.style.overflow = "";
    activeIdx = -1;
  }

  function isOpen() {
    return !modal.hidden;
  }

  // --- Data loading ---

  function loadIndex() {
    fetch(root + "/search-index.json")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        index = data;
        if (input.value.trim()) search(input.value);
      });
  }

  // --- Search ---

  function search(query) {
    if (!index) return;
    var q = query.trim();
    if (!q) {
      resultsEl.innerHTML = '<div class="search-empty">日付（例: 2024-08）やタグ名（例: SNS更新）を入力</div>';
      activeIdx = -1;
      return;
    }

    var terms = q.split(/\s+/).filter(Boolean);
    var results = index.filter(function (entry) {
      return terms.every(function (term) {
        var t = term.toLowerCase();
        if (entry.d.toLowerCase().includes(t)) return true;
        return entry.t.some(function (tag) {
          return tag.toLowerCase().includes(t);
        });
      });
    });

    renderResults(results);
  }

  function renderResults(results) {
    activeIdx = -1;
    if (results.length === 0) {
      resultsEl.innerHTML = '<div class="search-empty">検索結果はありません</div>';
      return;
    }

    var max = 100;
    var shown = results.slice(0, max);
    var byMonth = new Map();
    for (var i = 0; i < shown.length; i++) {
      var r = shown[i];
      if (!byMonth.has(r.m)) byMonth.set(r.m, []);
      byMonth.get(r.m).push(r);
    }

    var html = "";
    var itemIdx = 0;
    for (var entry of byMonth) {
      var month = entry[0];
      var entries = entry[1];
      html += '<div class="search-result-month">' + escapeHtml(month) + '</div>';
      for (var j = 0; j < entries.length; j++) {
        var e = entries[j];
        var tags = e.t.map(function (tag) {
          return '<span class="tag search-tag" data-tag="' + escapeHtml(tag) + '">' + escapeHtml(tag) + "</span>";
        }).join(" ");
        html += '<a href="' + root + "/" + e.u + '" class="search-result-item" data-idx="' + itemIdx + '">'
          + '<span class="date">' + escapeHtml(e.d) + "</span>"
          + '<span class="tags-inline">' + tags + "</span>"
          + "</a>";
        itemIdx++;
      }
    }

    if (results.length > max) {
      html += '<div class="search-more">他 ' + (results.length - max) + " 件</div>";
    }

    resultsEl.innerHTML = html;
  }

  // --- Keyboard navigation ---

  function getItems() {
    return resultsEl.querySelectorAll(".search-result-item");
  }

  function setActive(idx) {
    var items = getItems();
    if (items.length === 0) return;
    // Remove previous active
    for (var i = 0; i < items.length; i++) items[i].classList.remove("active");
    // Clamp index
    if (idx < 0) idx = items.length - 1;
    if (idx >= items.length) idx = 0;
    activeIdx = idx;
    items[activeIdx].classList.add("active");
    items[activeIdx].scrollIntoView({ block: "nearest" });
  }

  // --- Event listeners ---

  // Open via header button
  document.addEventListener("click", function (e) {
    if (e.target.closest(".search-trigger")) {
      e.preventDefault();
      openSearch();
    }
  });

  // Close via overlay click
  modal.addEventListener("click", function (e) {
    if (e.target.classList.contains("search-overlay")) {
      closeSearch();
    }
  });

  // Tag click in results
  resultsEl.addEventListener("click", function (e) {
    var tag = e.target.closest(".search-tag");
    if (tag) {
      e.preventDefault();
      e.stopPropagation();
      input.value = tag.dataset.tag;
      search(input.value);
      input.focus();
    }
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    // Open: Ctrl+K / Cmd+K
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      if (isOpen()) closeSearch(); else openSearch();
      return;
    }

    // Open: / key (when not in an input)
    if (e.key === "/" && !isOpen()) {
      var tag = document.activeElement.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault();
        openSearch();
        return;
      }
    }

    if (!isOpen()) return;

    // Close: Escape
    if (e.key === "Escape") {
      e.preventDefault();
      closeSearch();
      return;
    }

    // Navigate results
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(activeIdx + 1);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(activeIdx - 1);
      return;
    }

    // Select result
    if (e.key === "Enter") {
      var items = getItems();
      if (activeIdx >= 0 && activeIdx < items.length) {
        e.preventDefault();
        items[activeIdx].click();
      }
    }
  });

  // Search on input
  input.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      search(input.value);
    }, 150);
  });
})();
