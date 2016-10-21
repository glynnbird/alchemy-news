
var db = null;
var lastDoc = null;
var lastTaxonomy = null;
var lastArticles = null;

var last = function(k) {
  return k[k.length-1];
};

var clone = function(x) {
  return JSON.parse(JSON.stringify(x));
}

var showBreadcrumb = function(taxlinks, tag) {
  var html = '';
  var obj = { taxonomy: JSON.stringify([]), label: 'Home'};
  var template = $('#breadcrumb-template').html();
  Mustache.parse(template);
  html += Mustache.render(template, obj);

  if (tag) {
    template = $('#breadcrumb-template-tag').html();
    Mustache.parse(template);
    html += Mustache.render(template, { tag: tag});
  } else {
    var tax = [];
    for(i=1; i <= taxlinks.length; i++) {
      tax = taxlinks.slice(0,i);
      var label = (i ==0)? 'Home': taxlinks[i-1];
      obj = { taxonomy: JSON.stringify(tax), label: label};
      html += Mustache.render(template, obj);
    }
  }
  $('#breadcrumb').html(html);

}

var getTaxonomy = function(key) {

  var opts = { group_level: 1 };
  if (key) {
    opts.startkey = JSON.parse(JSON.stringify(key));
    opts.startkey.push('a');
    opts.endkey = JSON.parse(JSON.stringify(key));
    opts.endkey.push('z');
    opts.group_level = key.length + 1;
  }
  var stropts = JSON.stringify(opts);
  if (stropts == lastTaxonomy) {
    return;
  }
  lastTaxonomy = stropts;
  db.query('enhanced/taxonomy', opts).then(function(data) {
    var html = '';
    var template = $('#taxonomy-template').html();
    Mustache.parse(template);
    for(var i in data.rows) {
      var d = data.rows[i];
      d.label = last(d.key);
      d.key = JSON.stringify(d.key);
      html += Mustache.render(template, d);
    }
    $('#taxonomy').html(html);
    
  });
};


var fetchNewest = function() {
  db.query('enhanced/newest',{ descending:true, limit:15}).then(function(data) {
    var html = '';
    var template = $('#articles-template').html();
    Mustache.parse(template);
    for(var i in data.rows) {
      html += Mustache.render(template, data.rows[i]);
    }
    $('#articles').html(html);
  });
};

var fetchTaxonomy = function(opts) {
  var startkey = opts.taxonomy;
  var endkey = clone(opts.taxonomy);
  endkey.push('z');
  var o = {
    startkey: startkey,
    endkey: endkey,
    reduce: false
  };
  db.query('enhanced/taxonomy',o).then(function(data) {
    var html = '';
    var template = $('#articles-template').html();
    Mustache.parse(template);
    for(var i in data.rows) {
      html += Mustache.render(template, data.rows[i]);
    }
    $('#articles').html(html);
  });
};

var fetchTag = function(opts) {
  var startkey = [opts.tag];
  var endkey = clone(startkey);
  endkey.push('z');
  var o = {
    startkey: startkey,
    endkey: endkey,
    reduce: false
  };
  db.query('enhanced/entities',o).then(function(data) {
    var html = '';
    var template = $('#articles-template').html();
    Mustache.parse(template);
    for(var i in data.rows) {
      html += Mustache.render(template, data.rows[i]);
    }
    $('#articles').html(html);
  });
};

var getLatest = function(opts) {
  console.log('getLatest opts', opts);
  var optstr = JSON.stringify(opts);
  if (lastArticles == optstr) {
    console.log('no need to fetch articles');
    return;
  }
  console.log('getting latest');
  lastArticles = optstr;
  if (typeof opts.tag == 'string') {
    fetchTag(opts);
  } else if (typeof opts.taxonomy == 'object' && opts.taxonomy.length == 0) {
    fetchNewest();
  } else {
    fetchTaxonomy(opts);
  }

};


var parseHash = function() {
  var hash = location.hash;
  hash = hash.slice(3);
  var pairs = hash.split('&');
  var params = {};
  pairs.map(function(p) {
    var q = p.split('=');
    if (q[0]) {
      params[q[0]] = decodeURIComponent(q[1]);
    }
  });
  return params;
}

var generateHash = function(h) {
  var hash = '#/?'; 
  for(var i in h) {
    hash += encodeURIComponent(i) + '=' + encodeURIComponent(h[i]) + '&';;
  }
  if (hash.length >0) {
    hash = hash.slice(0, -1);
  }
  return hash;
}

var selectDoc = function(id) {
  var h = parseHash();
  h.id = id;
  location.hash = generateHash(h);
  //$('.article-item').removeClass('active');
  //$('#' + id).addClass('active');
};

var selectCategory = function(taxonomy) {
  var h = parseHash();
  delete h.tag;
  h.taxonomy = JSON.stringify(taxonomy);
  location.hash = generateHash(h);
}

var selectTag = function(tag) {
  var h = parseHash();
  h.tag = tag;
  h.taxonomy = JSON.stringify([]);
  location.hash = generateHash(h);
}

var getDoc = function(id) {
  if (lastDoc === id) {
    return;
  }
  lastDoc = id;
  db.get(id, function(err, data) {
    if (err) {
      return $('#article').html('');
    }
    var template = $('#article-template').html();
    Mustache.parse(template);
    var html = Mustache.render(template, data);
    $('#article').html(html);
  });
}

var renderPage = function() {
  var h = parseHash();
  if (!h.taxonomy) {
    h.taxonomy = [];
  } else {
    h.taxonomy = JSON.parse(h.taxonomy);
  }
  getTaxonomy(h.taxonomy);
  showBreadcrumb(h.taxonomy, h.tag);
  if (h.id) {
    getDoc(h.id);
  }
  getLatest(h);
}

var locationHashChanged = function () {
  console.log('location hash change', location.hash);
  renderPage();
}


$(function() {
  var CloudantURL = 'https://reader.cloudant.com/alchemy';
  db = new PouchDB(CloudantURL);
  window.onhashchange = locationHashChanged;
  renderPage();
});