
var db = null;
var lastDoc = null;
var lastTaxonomy = null;
var lastArticles = null;
var CLOUDANT_PROTOCOL = 'https';
var CLOUDANT_HOST = 'reader.cloudant.com';
var CLOUDANT_URL = CLOUDANT_PROTOCOL + '://' + CLOUDANT_HOST;
var CLOUDANT_DB = 'alchemy';

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

  console.log(taxlinks, tag);

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
  console.log(html);
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

var fetchSearch = function(opts) {
  var r = {
    method: 'get',
    protocol: CLOUDANT_PROTOCOL,
    host: CLOUDANT_HOST,
    db: CLOUDANT_DB,
    url: '_design/enhanced/_search/search?limit=20&q=' + encodeURIComponent(opts.search)
  };
  db.request(r).then(function(data) {
    var html = '';
    var template = $('#articles-template').html();
    Mustache.parse(template);
    for(var i in data.rows) {
      data.rows[i].value = data.rows[i].fields.title;
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
  if (typeof opts.search == 'string' && opts.search.length > 0) {
    fetchSearch(opts);
  } else if (typeof opts.tag == 'string') {
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
};

var selectCategory = function(taxonomy) {
  var h = parseHash();
  delete h.tag;
  delete h.search;
  h.taxonomy = JSON.stringify(taxonomy);
  location.hash = generateHash(h);
}

var selectTag = function(tag) {
  var h = parseHash();
  delete h.search;
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

var doSearch = function( event ) {
  event.preventDefault();
  var h = parseHash();
  delete h.tag;
  h.taxonomy = JSON.stringify([]);
  h.search = $('#searchterm').val();
  $('#searchterm').val('');
  $('#searchterm').blur();
  location.hash = generateHash(h);
}

var renderCountries = function() {
  var startkey = ['Country:'];
  var endkey = ['Country:z'];
  var o = {
    startkey: startkey,
    endkey: endkey,
    group_level: 1
  };
  console.log(o);
  db.query('enhanced/entities',o).then(function(data) {
    var template = $('#countries-template').html();
    Mustache.parse(template);
    for(var i in data.rows) {
      data.rows[i].key = data.rows[i].key[0];
      data.rows[i].name = data.rows[i].key.replace(/Country:/,'');
    }
    var html = Mustache.render(template, data);
    $('#countries').html(html);
    $('select').material_select();
    $('#countrieslist').change(function() {
      var str = $( "#countrieslist option:selected" ).val();
      selectTag(str);
    });
  });
};

var renderCities = function() {
  var startkey = ['City:'];
  var endkey = ['City:z'];
  var o = {
    startkey: startkey,
    endkey: endkey,
    group_level: 1
  };
  console.log(o);
  db.query('enhanced/entities',o).then(function(data) {
    var template = $('#cities-template').html();
    Mustache.parse(template);
    for(var i in data.rows) {
      data.rows[i].key = data.rows[i].key[0];
      data.rows[i].name = data.rows[i].key.replace(/City:/,'');
    }
    var html = Mustache.render(template, data);
    $('#cities').html(html);
    $('select').material_select();
    $('#citieslist').change(function() {
      var str = $( "#citieslist option:selected" ).val();
      selectTag(str);
    });
  });
};

var renderCompanies = function() {
  var startkey = ['Company:'];
  var endkey = ['Company:z'];
  var o = {
    startkey: startkey,
    endkey: endkey,
    group_level: 1
  };
  console.log(o);
  db.query('enhanced/entities',o).then(function(data) {
    var template = $('#companies-template').html();
    Mustache.parse(template);
    for(var i in data.rows) {
      data.rows[i].key = data.rows[i].key[0];
      data.rows[i].name = data.rows[i].key.replace(/Company:/,'');
    }
    var html = Mustache.render(template, data);
    $('#companies').html(html);
    $('select').material_select();
    $('#companieslist').change(function() {
      var str = $( "#companieslist option:selected" ).val();
      selectTag(str);
    });
  });
};

$(function() {
  var CloudantURL = CLOUDANT_URL + '/' + CLOUDANT_DB;
  db = new PouchDB(CloudantURL);
  window.onhashchange = locationHashChanged;
  $( "#search" ).submit(doSearch);
  renderPage();
  renderCountries();
  renderCities();
  renderCompanies();
});