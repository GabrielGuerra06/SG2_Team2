/*
    Adapted from Mike Bostock at bl.ocks.org
    https://bl.ocks.org/mbostock/5682158
*/

var margin = { top: 20, right: 300, bottom: 30, left: 50 },
    width = 800 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom,
    radius = Math.min(width, height) / 2;

// ////////////////////////// Donut Chart setup //////////////////////////

// Create the main SVG for the donut chart in #chart-area.
var svg = d3.select("#chart-area").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

// Center the donut chart in the SVG.
var g = svg.append("g")
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

// Create a tooltip div.
var tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// Define color scale: Accepted (green) and Rejected (red).
var color = d3.scaleOrdinal()
    .domain(["Accepted", "Rejected"])
    .range(["green", "red"]);

// Create the arc generator for a donut chart.
var arc = d3.arc()
    .innerRadius(radius * 0.5)
    .outerRadius(radius - 10);

// Create the pie layout generator.
var pie = d3.pie()
    .sort(null)
    .value(function(d) { return d.count; });

// Load the simulation JSON data.
d3.json("data/test.json").then(function(data) {
    // Default to the first simulation record.
    var simulationRecord = data[0];

    // Build pie data with two objects.
    var pieData = [
        { region: "Accepted", count: simulationRecord.accepted_products },
        { region: "Rejected", count: simulationRecord.rejected_products }
    ];

    // Bind the pie data and append paths.
    var arcs = g.selectAll("path")
        .data(pie(pieData))
      .enter().append("path")
        .attr("d", arc)
        .attr("fill", function(d) { return color(d.data.region); })
        .each(function(d) { this._current = d; })
        .on("mouseover", function(d) {
            tooltip.transition().duration(200)
                .style("opacity", 0.9);
            tooltip.html("<strong>" + d.data.region + ":</strong> " + d.data.count)
                .style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
            tooltip.transition().duration(500)
                .style("opacity", 0);
        });

    // //////////////////////////// //////////////////////////////////bar cgraph
    // Bar Chart for Occupancy per Workstation

    // Extract the occupancy per workstation array from the simulation record.
    var occupancy = simulationRecord.occupancy_per_workstation;
    // Create an array of objects with workstation names and occupancy percentage.
    var barData = occupancy.map(function(d, i) {
      return {
        workstation: "Workstation " + (i + 1),
        occupancy: d * 100 // Convert to percentage.
      };
    });

    // Set up dimensions for the bar chart.
    var barMargin = { top: 20, right: 20, bottom: 40, left: 50 },
        barWidth = 800 - barMargin.left - barMargin.right,
        barHeight = 400 - barMargin.top - barMargin.bottom;

    // Append a new SVG for the bar chart to the container #bar-chart.
    var barSvg = d3.select("#bar-chart").append("svg")
        .attr("width", barWidth + barMargin.left + barMargin.right)
        .attr("height", barHeight + barMargin.top + barMargin.bottom)
      .append("g")
        .attr("transform", "translate(" + barMargin.left + "," + barMargin.top + ")");

    // Define the x scale as an ordinal (band) scale for workstation labels.
    var xScale = d3.scaleBand()
        .domain(barData.map(function(d) { return d.workstation; }))
        .range([0, barWidth])
        .padding(0.2);

    // Define the y scale as linear for the occupancy percentages.
    var yScale = d3.scaleLinear()
        .domain([0, d3.max(barData, function(d) { return d.occupancy; })])
        .nice()
        .range([barHeight, 0]);

    // Append the x axis.
    barSvg.append("g")
        .attr("transform", "translate(0," + barHeight + ")")
        .call(d3.axisBottom(xScale));

    // Append the y axis and format the ticks with "%" symbol.
    barSvg.append("g")
        .call(d3.axisLeft(yScale).tickFormat(function(d) { return d + "%"; }));

    // Create and append the bars for each workstation.
    barSvg.selectAll(".bar")
        .data(barData)
      .enter().append("rect")
        .attr("class", "bar")
        .attr("x", function(d) { return xScale(d.workstation); })
        .attr("y", function(d) { return yScale(d.occupancy); })
        .attr("width", xScale.bandwidth())
        .attr("height", function(d) { return barHeight - yScale(d.occupancy); })
        .attr("fill", "steelblue")
        .on("mouseover", function(d) {
            tooltip.transition().duration(200)
                .style("opacity", 0.9);
            tooltip.html("<strong>" + d.workstation + ":</strong> " + d.occupancy.toFixed(2) + "%")
                .style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
            tooltip.transition().duration(500)
                .style("opacity", 0);
        });

    
    // ////////////////////// Production Rejection Percentage Gauge Chart //////////////////////

    // Extract production rejection percentage.
    var rejectionPct = simulationRecord.production_rejection_percentage;

    // Set up dimensions for the gauge chart.
    var gaugeMargin = { top: 20, right: 20, bottom: 20, left: 20 },
        gaugeWidth = 300 - gaugeMargin.left - gaugeMargin.right,
        gaugeHeight = 150 - gaugeMargin.top - gaugeMargin.bottom;

    // Append the SVG for the gauge chart.
    var gaugeSvg = d3.select("#gauge-chart").append("svg")
        .attr("width", gaugeWidth + gaugeMargin.left + gaugeMargin.right)
        .attr("height", gaugeHeight + gaugeMargin.top + gaugeMargin.bottom)
    .append("g")
        // Translate to center-bottom for a semicircular gauge.
        .attr("transform", "translate(" + ((gaugeWidth / 2) + gaugeMargin.left) + "," + (gaugeHeight + gaugeMargin.top) + ")");

    // Define a linear scale to map values from 0 to 100 to angles between -90° and 90° (in radians).
    var gaugeScale = d3.scaleLinear()
        .domain([0, 100])
        .range([-Math.PI/2, Math.PI/2]);

    // Define the arc generator for the gauge; set inner and outer radii as desired.
    var arcGenerator = d3.arc()
        .innerRadius(40)
        .outerRadius(60)
        .startAngle(-Math.PI/2);  // Gauge always starts at -90°

    // Draw the background arc (full gauge) in light gray.
    gaugeSvg.append("path")
        .datum({ endAngle: Math.PI/2 })
        .style("fill", "#e6e6e6")
        .attr("d", arcGenerator);

    // Draw the foreground arc (indicator) in red (or another color) to represent the rejection percentage.
    gaugeSvg.append("path")
        .datum({ endAngle: gaugeScale(rejectionPct) })
        .style("fill", "red")
        .attr("d", arcGenerator);

    // Display the rejection percentage as text above the gauge.
    gaugeSvg.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "-1.5em")
        .style("font-size", "16px")
        .text(rejectionPct.toFixed(2) + "%");

    // Optionally, draw a needle to indicate the value.
    // Replace the old needle code with the following:

    // Define the length of the needle.
    var needleLength = 60;  // adjust as needed

    // Define the needle path as a vertical line (pointing upward) with a small offset at the base.
    var needleData = [
        { x: 0, y: 10 },    // Base offset (you can adjust this offset as needed)
        { x: 0, y: -needleLength }  // Tip of the needle
    ];

    // Create a line generator for the needle.
    var needleLineGenerator = d3.line()
        .x(function(d) { return d.x; })
        .y(function(d) { return d.y; });

    // Calculate the needle's rotation angle in degrees from the rejection percentage.
    // (Using the original gaugeScale mapping: domain [0,100] to [-Math.PI/2, Math.PI/2])
    var needleAngleDeg = gaugeScale(rejectionPct) * 180 / Math.PI;

    // Append a new group for the needle that will be rotated by the computed angle.
    var needleG = gaugeSvg.append("g")
        .attr("class", "needle")
        .attr("transform", "rotate(" + needleAngleDeg + ")");

    // Append the needle path inside the rotated group.
    needleG.append("path")
        .attr("d", needleLineGenerator(needleData))
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 2);

// ////////////////////// Average Production Time per Workstation Circle Graph //////////////////////

// Prepare the data.
var avgProdTimes = simulationRecord.avg_production_time;
var prodTimeData = avgProdTimes.map(function(d, i) {
  return {
      workstation: "Workstation " + (i + 1),
      time: d,
      // Dummy error value: 5% of the production time.
      error: 0.05 * d
  };
});

// Set up dimensions and radii for the radial chart.
var circWidth = 400, circHeight = 400,
    circInnerRadius = 50, circOuterRadius = 150;

// Append an SVG for the circle graph.
var circSvg = d3.select("#prod-chart").append("svg")
  .attr("width", circWidth)
  .attr("height", circHeight)
  .append("g")
  .attr("transform", "translate(" + circWidth / 2 + "," + circHeight / 2 + ")");

// Define a radial scale mapping production time (with error bounds) to the radial range.
var rScale = d3.scaleLinear()
  .domain([
    d3.min(prodTimeData, function(d) { return d.time - d.error; }),
    d3.max(prodTimeData, function(d) { return d.time + d.error; })
  ])
  .range([circInnerRadius, circOuterRadius]);

var totalSegments = prodTimeData.length;
var angleStep = 2 * Math.PI / totalSegments;
// Define a color scale for distinct colors for each workstation.
var colorScale = d3.scaleOrdinal()
    .domain(prodTimeData.map(function(d) { return d.workstation; }))
    .range(d3.schemeCategory10);

// Draw each radial bar (arc) representing the average production time without error bars.
circSvg.selectAll(".arc")
  .data(prodTimeData)
  .enter().append("path")
  .attr("class", "arc")
  .attr("d", function(d, i) {
    var startAngle = i * angleStep;
    var endAngle = (i + 1) * angleStep;
    return d3.arc()
      .innerRadius(circInnerRadius)
      .outerRadius(rScale(d.time))
      .startAngle(startAngle)
      .endAngle(endAngle)();
  })
  .attr("fill", function(d) { return colorScale(d.workstation); })
  .on("mouseover", function(d) {
    tooltip.transition().duration(200)
      .style("opacity", 0.9);
    tooltip.html("<strong>" + d.workstation + ":</strong> " + d.time.toFixed(2) + " s")
      .style("left", (d3.event.pageX + 10) + "px")
      .style("top", (d3.event.pageY - 28) + "px");
  })
  .on("mouseout", function(d) {
    tooltip.transition().duration(500)
      .style("opacity", 0);
  });

    }).catch(function(error) {
        console.log(error);
    });

// KEY, NEIGHBOR, and TWEEN FUNCTIONS (for smooth transitions in the donut chart).
function key(d) {
    return d.data.region;
}

function findNeighborArc(i, data0, data1, key) {
    var d;
    return (d = findPreceding(i, data0, data1, key)) ? { startAngle: d.endAngle, endAngle: d.endAngle }
         : (d = findFollowing(i, data0, data1, key)) ? { startAngle: d.startAngle, endAngle: d.startAngle }
         : null;
}

function findPreceding(i, data0, data1, key) {
    var m = data0.length;
    while (--i >= 0) {
        var k = key(data1[i]);
        for (var j = 0; j < m; ++j) {
            if (key(data0[j]) === k) return data0[j];
        }
    }
}

function findFollowing(i, data0, data1, key) {
    var n = data1.length, m = data0.length;
    while (++i < n) {
        var k = key(data1[i]);
        for (var j = 0; j < m; ++j) {
            if (key(data0[j]) === k) return data0[j];
        }
    }
}

function arcTween(d) {
    var i = d3.interpolate(this._current, d);
    this._current = i(1);
    return function(t) {
        return arc(i(t));
    };
}


