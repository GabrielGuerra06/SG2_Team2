/*
    Adapted from Mike Bostock at bl.ocks.org
    https://bl.ocks.org/mbostock/5682158

    Modified to include a D3 slider (with tooltip) and a Play button for dynamic instance updates.
*/

// Global configuration for time periods (in days).
var daysCount = {
    day: 1,
    week: 7,
    month: 30,
    year: 365
};

var allData; // Global store for the loaded JSON data.
var playInterval; // Interval for play button animation.

// ---------------------------------------------------------------------------
// Data Aggregation (unchanged)
// ---------------------------------------------------------------------------
function aggregateData(daysArray) {
    var aggregated = {};

    aggregated.accepted_products = d3.sum(daysArray, d => d.accepted_products);
    aggregated.rejected_products = d3.sum(daysArray, d => d.rejected_products);
    aggregated.total_products = aggregated.accepted_products + aggregated.rejected_products;
    aggregated.production_rejection_percentage = (aggregated.rejected_products / aggregated.total_products) * 100;

    // Aggregate occupancy per workstation.
    var numWS = daysArray[0].occupancy_per_workstation.length;
    aggregated.occupancy_per_workstation = [];
    for (var i = 0; i < numWS; i++) {
        aggregated.occupancy_per_workstation[i] = d3.mean(daysArray, d => d.occupancy_per_workstation[i]);
    }

    // Aggregate production time per workstation.
    var numWS2 = daysArray[0].avg_production_time.length;
    aggregated.avg_production_time = [];
    for (var i = 0; i < numWS2; i++) {
        aggregated.avg_production_time[i] = d3.mean(daysArray, d => d.avg_production_time[i]);
    }

    aggregated.avg_delay_time = d3.mean(daysArray, d => d.avg_delay_time);
    aggregated.accident_rate = d3.mean(daysArray, d => d.accident_rate);
    aggregated.supplier_occupancy = d3.mean(daysArray, d => d.supplier_occupancy);
    aggregated.avg_fix_time = d3.mean(daysArray, d => d.avg_fix_time);
    aggregated.avg_bottleneck_delay = d3.mean(daysArray, d => d.avg_bottleneck_delay);
    aggregated.faulty_product_rate = d3.mean(daysArray, d => d.faulty_product_rate);
    aggregated.accidents = d3.sum(daysArray, d => d.accidents);

    if (daysArray[0].workstation_status) {
        aggregated.workstation_status = [];
        var numStatuses = daysArray[0].workstation_status.length;
        for (var i = 0; i < numStatuses; i++) {
            aggregated.workstation_status[i] = {
                operational: d3.mean(daysArray, d => d.workstation_status[i].operational),
                downtime: d3.mean(daysArray, d => d.workstation_status[i].downtime),
                waiting_for_restock: d3.mean(daysArray, d => d.workstation_status[i].waiting_for_restock)
            };
        }
    }

    if (daysArray[0].bottleneck_workstations) {
        aggregated.bottleneck_workstations = {};
        var waitingTimesLength = daysArray[0].bottleneck_workstations.waiting_times.length;
        aggregated.bottleneck_workstations.waiting_times = [];
        for (var i = 0; i < waitingTimesLength; i++) {
            aggregated.bottleneck_workstations.waiting_times[i] =
                d3.mean(daysArray, d => d.bottleneck_workstations.waiting_times[i]);
        }
        aggregated.bottleneck_workstations.max_waiting_time =
                d3.max(daysArray, d => d.bottleneck_workstations.max_waiting_time);
        aggregated.bottleneck_workstations.bottleneck_station =
                aggregated.bottleneck_workstations.waiting_times.indexOf(aggregated.bottleneck_workstations.max_waiting_time);
    }

    return aggregated;
}

// ---------------------------------------------------------------------------
// Chart Rendering Functions (unchanged from previous code)
// ---------------------------------------------------------------------------
function renderDonutChart(simulationRecord, tooltip) {
    var margin = { top: 20, right: 20, bottom: 20, left: 20 },
        width = 600 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom,
        radius = Math.min(height, width) / 2;
    
    var svg = d3.select("#chart-area").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);
    
    var g = svg.append("g")
        .attr("transform", "translate(" + (width/2 + margin.left) + "," + (height/2 + margin.top) + ")");
    
    var color = d3.scaleOrdinal()
        .domain(["Accepted", "Rejected"])
        .range(["green", "red"]);
    
    var arc = d3.arc()
        .innerRadius(radius * 0.5)
        .outerRadius(radius - 10);
    
    var pie = d3.pie()
        .sort(null)
        .value(d => d.count);
    
    var pieData = [
        { region: "Accepted", count: simulationRecord.accepted_products },
        { region: "Rejected", count: simulationRecord.rejected_products }
    ];
    
    g.selectAll("path")
      .data(pie(pieData))
      .enter().append("path")
        .attr("d", arc)
        .attr("fill", d => color(d.data.region))
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
}

function renderBarChart(simulationRecord, tooltip) {
    var occupancy = simulationRecord.occupancy_per_workstation;
    var barData = occupancy.map(function(d, i) {
      return {
        workstation: "Workstation " + (i + 1),
        occupancy: d * 100
      };
    });
    
    var barMargin = { top: 20, right: 20, bottom: 40, left: 50 },
        barWidth = 800 - barMargin.left - barMargin.right,
        barHeight = 400 - barMargin.top - barMargin.bottom;
    
    var barSvg = d3.select("#bar-chart").append("svg")
        .attr("width", barWidth + barMargin.left + barMargin.right)
        .attr("height", barHeight + barMargin.top + barMargin.bottom)
      .append("g")
        .attr("transform", "translate(" + barMargin.left + "," + barMargin.top + ")");
    
    var xScale = d3.scaleBand()
        .domain(barData.map(d => d.workstation))
        .range([0, barWidth])
        .padding(0.2);
    
    var yScale = d3.scaleLinear()
        .domain([0, d3.max(barData, d => d.occupancy)])
        .nice()
        .range([barHeight, 0]);
    
    barSvg.append("g")
        .attr("transform", "translate(0," + barHeight + ")")
        .call(d3.axisBottom(xScale));
    
    barSvg.append("g")
        .call(d3.axisLeft(yScale).tickFormat(d => d + "%"));
    
    barSvg.selectAll(".bar")
        .data(barData)
      .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d.workstation))
        .attr("y", d => yScale(d.occupancy))
        .attr("width", xScale.bandwidth())
        .attr("height", d => barHeight - yScale(d.occupancy))
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
}

function renderGaugeChart(simulationRecord, tooltip) {
    var rejectionPct = simulationRecord.production_rejection_percentage;
    var gaugeMargin = { top: 20, right: 20, bottom: 20, left: 20 },
        gaugeWidth = 300 - gaugeMargin.left - gaugeMargin.right,
        gaugeHeight = 150 - gaugeMargin.top - gaugeMargin.bottom;
    
    var gaugeSvg = d3.select("#gauge-chart").append("svg")
        .attr("width", gaugeWidth + gaugeMargin.left + gaugeMargin.right)
        .attr("height", gaugeHeight + gaugeMargin.top + gaugeMargin.bottom)
      .append("g")
        .attr("transform", "translate(" + ((gaugeWidth / 2) + gaugeMargin.left) + "," + (gaugeHeight + gaugeMargin.top) + ")");
    
    var gaugeScale = d3.scaleLinear()
        .domain([0, 100])
        .range([-Math.PI/2, Math.PI/2]);
    
    var arcGenerator = d3.arc()
        .innerRadius(40)
        .outerRadius(60)
        .startAngle(-Math.PI/2);
    
    gaugeSvg.append("path")
        .datum({ endAngle: Math.PI/2 })
        .style("fill", "#e6e6e6")
        .attr("d", arcGenerator);
    
    gaugeSvg.append("path")
        .datum({ endAngle: gaugeScale(rejectionPct) })
        .style("fill", "red")
        .attr("d", arcGenerator);
    
    gaugeSvg.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "-1.5em")
        .style("font-size", "16px")
        .text(rejectionPct.toFixed(2) + "%");
    
    var needleLength = 60;
    var needleData = [
        { x: 0, y: 10 },
        { x: 0, y: -needleLength }
    ];
    var needleLineGenerator = d3.line()
        .x(d => d.x)
        .y(d => d.y);
    
    var needleAngleDeg = gaugeScale(rejectionPct) * 180 / Math.PI;
    
    var needleG = gaugeSvg.append("g")
        .attr("class", "needle")
        .attr("transform", "rotate(" + needleAngleDeg + ")");
    
    needleG.append("path")
        .attr("d", needleLineGenerator(needleData))
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 2);
}

function renderCircleGraph(simulationRecord, tooltip) {
    var avgProdTimes = simulationRecord.avg_production_time;
    var prodTimeData = avgProdTimes.map(function(d, i) {
      return {
          workstation: "Workstation " + (i + 1),
          time: d,
          error: 0.05 * d
      };
    });
    
    var circWidth = 400, circHeight = 400,
        circInnerRadius = 50, circOuterRadius = 150;
    
    var circSvg = d3.select("#prod-chart").append("svg")
      .attr("width", circWidth)
      .attr("height", circHeight)
      .append("g")
      .attr("transform", "translate(" + circWidth / 2 + "," + circHeight / 2 + ")");
    
    var rScale = d3.scaleLinear()
      .domain([
        d3.min(prodTimeData, d => d.time - d.error),
        d3.max(prodTimeData, d => d.time + d.error)
      ])
      .range([circInnerRadius, circOuterRadius]);
    
    var totalSegments = prodTimeData.length;
    var angleStep = 2 * Math.PI / totalSegments;
    
    var colorScale = d3.scaleOrdinal()
        .domain(prodTimeData.map(d => d.workstation))
        .range(d3.schemeCategory10);
    
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
      .attr("fill", d => colorScale(d.workstation))
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
}

function updateCharts(simulationRecord) {
    // Remove previous chart SVGs.
    d3.select("#chart-area").selectAll("*").remove();
    d3.select("#bar-chart").selectAll("*").remove();
    d3.select("#gauge-chart").selectAll("*").remove();
    d3.select("#prod-chart").selectAll("*").remove();
    
    var tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);
    
    renderDonutChart(simulationRecord, tooltip);
    renderBarChart(simulationRecord, tooltip);
    renderGaugeChart(simulationRecord, tooltip);
    renderCircleGraph(simulationRecord, tooltip);
}

// ---------------------------------------------------------------------------
// Create slider and play button for selecting instance dynamically
// ---------------------------------------------------------------------------
function renderSlider(period) {
    // Clear any existing slider or play button.
    d3.select("#sub-nav").html("");
    var periodDays = daysCount[period];
    var totalInstances = Math.floor(allData.length / periodDays);
    if (allData.length % periodDays !== 0) totalInstances++;

    // Create a label for the slider.
    d3.select("#sub-nav")
      .append("span")
      .attr("id", "slider-label")
      .text(period.charAt(0).toUpperCase() + period.slice(1) + " instance:");
    
    // Create the slider using an input element.
    var slider = d3.select("#sub-nav")
      .append("input")
      .attr("id", "instance-slider")
      .attr("type", "range")
      .attr("min", 0)
      .attr("max", totalInstances - 1)
      .attr("step", 1)
      .attr("value", totalInstances - 1)  // Default to the most recent instance.
      .style("margin", "0 10px")
      .on("input", function() {
          var instance = +this.value;
          updateForInstance(period, instance);
      });
    
    // Create a play button.
    d3.select("#sub-nav")
      .append("button")
      .attr("id", "play-button")
      .text("Play")
      .on("click", function() {
          // If already playing, stop.
          if (playInterval) {
              clearInterval(playInterval);
              playInterval = null;
              d3.select(this).text("Play");
          } else {
              d3.select(this).text("Stop");
              playInterval = setInterval(function() {
                  var current = +d3.select("#instance-slider").node().value;
                  if (current < totalInstances - 1) {
                      current++;
                  } else {
                      current = 0;
                  }
                  d3.select("#instance-slider").property("value", current);
                  updateForInstance(period, current);
              }, 1000); // Adjust the delay (in ms) between updates as needed.
          }
      });
}

// ---------------------------------------------------------------------------
// Update charts for a given instance and period
// ---------------------------------------------------------------------------
function updateForInstance(period, instance) {
    var periodDays = daysCount[period];
    // Slice the data based on instance index.
    var start = instance * periodDays;
    var end = (instance + 1) * periodDays;
    var sliceData = allData.slice(start, end);
    var aggregatedData = aggregateData(sliceData);
    updateCharts(aggregatedData);
}

// ---------------------------------------------------------------------------
// Primary Navigation: Setup period buttons
// ---------------------------------------------------------------------------
function setUpPrimaryNav() {
    d3.selectAll(".primary-nav").on("click", function() {
       var period = d3.select(this).attr("data-period");
       // Render the slider (and play button) for this period.
       renderSlider(period);
       var periodDays = daysCount[period];
       var totalInstances = Math.floor(allData.length / periodDays);
       if (allData.length % periodDays !== 0) totalInstances++;
       // Default to the most recent instance.
       updateForInstance(period, totalInstances - 1);
    });
}

// ---------------------------------------------------------------------------
// Main Function
// ---------------------------------------------------------------------------
function main() {
    d3.json("data/test.json").then(function(data) {
        allData = data;
        setUpPrimaryNav();
        // Trigger default: select "day" period.
        d3.select(".primary-nav[data-period='day']").dispatch("click");
    }).catch(function(error) {
        console.error("Error al cargar el JSON:", error);
    });
}

// Optional helper functions (unchanged).
function key(d) { return d.data.region; }
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
        return d3.arc().innerRadius(100).outerRadius(150)(i(t));
    };
}

// ---------------------------------------------------------------------------
// Start application
// ---------------------------------------------------------------------------
main();
