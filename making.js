

//
// Data setup
//
var maps, data;
var start_year = 1917;
var end_year = 2016;

var classifications = [100, 500, 1000, 2000, 5000, 15000, Number.POSITIVE_INFINITY]; // ..and beyond
var explanations = ['alle 100', '100 - 500', '500 - 1 000', '1 000 - 2 000', '2 000 - 5 000', '5 000 - 15 000', 'yli 15 000'];

var map_names = [
    'data/Laanit_1917_1920_1.geojson',
    'data/Laanit_1921_1937_2.geojson',
    'data/Laanit_1938_1940_3.geojson',
    'data/Laanit_1941_1944_4.geojson',
    'data/Laanit_1945_1947_5.geojson',
    'data/Laanit_1948_1959_6.geojson',
    'data/Laanit_1960_1994_7.geojson',
    'data/Maakunnat_8.geojson'
];
var map_ranges = [1921, 1938, 1941, 1945, 1948, 1960, 1995, Number.POSITIVE_INFINITY];

var suomenlinna = "#F5A3C7";
var colors = colorbrewer.Blues[7];

var darker = function (color) { return d3.rgb(color).darker(); };

function get_map_for_year(year) {
    var x;
    map_ranges.find(function (range, index) {
        if (year < range) {
            x = map_names[index];
            return true;
        }
    });
    return x;
}

//
// Fetching maps and data
//

async function loader() {

var maps = {};

map_names.forEach(async function (name) {
    var res = await fetch(name);
    var map = await res.json();
    maps[name] = map;
});

var r2 = await fetch('data/laanit.csv');
var laanit_text = await r2.text();
var laanit_list = [];
d3.dsvFormat(';').parse(laanit_text, function (d) { return laanit_list.push(d); });
var laanit = {};
laanit_list.forEach(
        function (item) {
            var y = item["VUOSI"];
            laanit[y] = _.omit(item, ['VUOSI', 'Yhteensä', ""]);
            laanit[y]['map'] = get_map_for_year(y);
        }
);

var r3 = await fetch('data/maakunnat.csv');
var maakunnat_text = await r3.text();
var maakunnat_list = [];
d3.dsvFormat(';').parse(maakunnat_text, function (d) { return maakunnat_list.push(d); });
var maakunnat = {};
maakunnat_list.forEach(
    function (item) {
        var y = item["VUOSI"];
        maakunnat[y] = _.omit(item, ['VUOSI', 'Yhteensä', ""]);
        maakunnat[y]['map'] = get_map_for_year(y);
    }
);

var data = {};
Object.assign(data, laanit);
Object.assign(data, maakunnat);

return {maps: maps, data: data};

}

//
// Map setup
//

function createMap(geojson, data) {
var classes = {};
Object.keys(data).forEach(
    function (key) {

        // Empty data for this space
        if (data[key] === "") {
            classes[key] = null;
            return
        }

        for (var i = 0, list = classifications.entries(); i < list.length; i += 1) {
            var ref = list[i];
            var index = ref[0];
            var limit = ref[1];

            if (data[key] < limit) {
                classes[key] = index;
                break;
            }
        }
    }
);

var width = 350,
    height = 500;

var svg = d3.select("#viz svg");
svg.selectAll("*").remove();

var projection = d3.geoTransverseMercator().fitSize([width, height], geojson)
                    .rotate([-27,-65,0])
                    .translate([(width/2) + 30, height/2])
                    .scale([2802]);

var path = d3.geoPath().projection(projection);

var g = svg.append("g")
            .style("stroke-width", "1.5px");

g.selectAll('path')
    .data(geojson.features)
    .enter()
    .append('path')
    .attr('d', path)
    .style("fill", function (d) {
        if (d.properties.nimi === 'HELSINKI') { return suomenlinna; } // Suomenlinna
        else if (classes[d.properties.nimi] !== null) {
        return colors[classes[d.properties.nimi]];
        }
    })
    .style("stroke-width", function (d) { return d.properties.nimi === 'HELSINKI' ? "3" : "1"; })
    .style("stroke", function (d) {
    switch (d.properties.nimi) {
        case 'HELSINKI':
        return darker(suomenlinna);
        case 'UUDENMAAN LÄÄNI':
        return "none";
        default:
        return "white";
    }
    })
    .append("title").text(function (d) {
        if (d.properties.nimi === 'HELSINKI') { return "suomenlinna"; } // Suomenlinna
        else if (classes[d.properties.nimi] !== null) {
            return d.properties.nimi + " " + data[d.properties.nimi];
        }
    })
;
}

async function render(year) {
    var res = await loader();
    maps = res["maps"];
    data = res["data"];
    // Instantiate a slider
    var stuff = _.flatten([
        start_year,
        _.range(start_year, end_year).filter(function (v) { return v % 10 === 0; }),
        end_year
    ]);
    var years = _.range(start_year, end_year);
    var mySlider = new Slider("input#slider", {
        ticks: stuff,
        ticks_labels: stuff,
        ticks_positions: [0, 5, 15, 25, 35, 45, 55, 65, 75, 85, 93, 100],
        min: start_year,
        max: end_year
    });

    mySlider.on('change', function (v) { return set_year(v.newValue); });

    var animate;

    function advancer(num) {
        if (animate && num < end_year) {
            mySlider.setValue(num, true, true);
            setTimeout(function () {
                advancer(num + 1);
            }, 500);
        }
    }

    d3.select('#animate button')
        .on('click', function () {
            console.log("hrm", this);
            if (animate) {
                animate = false;
                d3.select(this).text('Animaatio');
            } else {
                animate = true;
                d3.select(this).text('Stop');
            }
            advancer(year);
        });

    make_legend();

    createMap(maps[data[year]["map"]], data[year]);
}


// Legend

function make_legend () {
    d3.select('div#legend')
        .selectAll('span')
        .data(colors)
        .enter()
        .append('span')
        .attr('style', function (d) { return 'background-color:' + d; })
        .attr('class', 'color')
        .append('span')
        .attr('class', 'label')
        .text(function (d, i) { return explanations[i]; });
}

function set_year(year) {
    createMap(maps[data[year]["map"]], data[year]);
}

render(start_year);

