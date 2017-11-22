
import *  as colorbrewer from './assets/colorbrewer';

import * as d3 from 'd3';
import * as _ from 'lodash';

//
// Data setup
//
let maps, data;
let start_year = 1917;
let end_year = 2016;

let classifications = [100, 500, 1000, 2000, 5000, 15000, Number.POSITIVE_INFINITY]; // ..and beyond
let explanations = ['alle 100', '100 - 500', '500 - 1 000', '1 000 - 2 000', '2 000 - 5 000', '5 000 - 15 000', 'yli 15 000'];

let map_names = [
    'data/Laanit_1917_1920_1.geojson',
    'data/Laanit_1921_1937_2.geojson',
    'data/Laanit_1938_1940_3.geojson',
    'data/Laanit_1941_1944_4.geojson',
    'data/Laanit_1945_1947_5.geojson',
    'data/Laanit_1948_1959_6.geojson',
    'data/Laanit_1960_1994_7.geojson',
    'data/Maakunnat_8.geojson'
];
let map_ranges = [1921, 1938, 1941, 1945, 1948, 1960, 1995, Number.POSITIVE_INFINITY];

let suomenlinna = "#F5A3C7";
let colors = colorbrewer.Blues[7];

let darker = (color) => d3.rgb(color).darker();

function get_map_for_year(year) {
    let x;
    _.find(map_ranges, (range, index) => {
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

    let maps = {};

    map_names.forEach(async function (name) {
        let res = await fetch(name);
        let map = await res.json();
        maps[name] = map;
    });

    let r2 = await fetch('data/laanit.csv');
    let laanit_text = await r2.text();
    let laanit_list = [];
    d3.dsvFormat(';').parse(laanit_text, (d) => laanit_list.push(d));
    let laanit = {};
    laanit_list.forEach(
            (item) => {
                const y = item["VUOSI"];
                laanit[y] = _.omit(item, ['VUOSI', 'Yhteensä', ""]);
                laanit[y]['map'] = get_map_for_year(y);
            }
    );

    let r3 = await fetch('data/maakunnat.csv');
    let maakunnat_text = await r3.text();
    let maakunnat_list = [];
    d3.dsvFormat(';').parse(maakunnat_text, (d) => maakunnat_list.push(d));
    let maakunnat = {};
    maakunnat_list.forEach(
        (item) => {
            const y = item["VUOSI"];
            maakunnat[y] = _.omit(item, ['VUOSI', 'Yhteensä', ""]);
            maakunnat[y]['map'] = get_map_for_year(y);
        }
    );

    let data = {};
    Object.assign(data, laanit);
    Object.assign(data, maakunnat);

    return {maps, data};

}

//
// Map setup
//

function createMap(geojson, data) {
let classes = {};
Object.keys(data).forEach(
    (key) => {

        // Empty data for this space
        if (data[key] === "") {
            classes[key] = null;
            return
        }

        for (let [index, limit] of classifications.entries()) {
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
    .style("fill", d => {
        if (d.properties.nimi === 'HELSINKI') return suomenlinna; // Suomenlinna
        else if (classes[d.properties.nimi] !== null) {
        return colors[classes[d.properties.nimi]];
        }
    })
    .style("stroke-width", d => d.properties.nimi === 'HELSINKI' ? "3" : "1")
    .style("stroke", d => {
    switch (d.properties.nimi) {
        case 'HELSINKI':
        return darker(suomenlinna);
        case 'UUDENMAAN LÄÄNI':
        return "none";
        default:
        return "white";
    }
    })
    .append("title").text(d => {
        if (d.properties.nimi === 'HELSINKI') return "suomenlinna"; // Suomenlinna
        else if (classes[d.properties.nimi] !== null) {
            return d.properties.nimi + " " + data[d.properties.nimi];
        }
    })
;
}

async function render(year) {
    let res = await loader();
    maps = res["maps"];
    data = res["data"];
    // Instantiate a slider
    let stuff = _.flatten([
        start_year,
        _.range(start_year, end_year).filter(v => v % 10 === 0),
        end_year
    ]);
    let years = _.range(start_year, end_year);
    let mySlider = new Slider("input#slider", {
        ticks: stuff,
        ticks_labels: stuff,
        ticks_positions: [0, 5, 15, 25, 35, 45, 55, 65, 75, 85, 93, 100],
        min: start_year,
        max: end_year
    });

    mySlider.on('change', v => set_year(v.newValue));

    let animate;

    function advancer(num) {
        if (animate && num < end_year) {
            mySlider.setValue(num, true, true);
            setTimeout(() => {
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
        .attr('style', d => 'background-color:' + d)
        .attr('class', 'color')
        .append('span')
        .attr('class', 'label')
        .text((d, i) => explanations[i]);
}

function set_year(year) {
    createMap(maps[data[year]["map"]], data[year]);
}

render(start_year);
