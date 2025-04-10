
// -------------------------------------------------
// Global Variables and Configuration
// -------------------------------------------------
var allData = [];   // Loaded JSON data
var currentPeriod = 'day';
var playInterval;

var daysCount = { day: 1, week: 7, month: 30, year: 365 };

// Global chart selections
var donutSvg, donutG;
var barSvg, barG;
var gaugeSvg, gaugeG;
var circleSvg, circleG;
var arcGenerator, colorScaleCircle;

// Create a single tooltip div (for D3 v4, we do not use arrow function for events)
var tooltip = d3.select("body").append("div")
  .attr("class", "tooltip");

// -------------------------------------------------
// Main: Load Data and Initialize
// -------------------------------------------------
function main() {
  
    d3.json("data/test.json")
      .then(function(data) {
        allData = data;
        setUpPrimaryNav();
        // Initialize charts (only once)
        initDonutChart();
        initBarChart();
        initGaugeChart();
        initCircleChart();
        // Trigger default period ("day")
        d3.select(".primary-nav[data-period='day']").dispatch("click");
      })
      .catch(function(error) {
        console.error("Error loading JSON:", error);
      });
  }
main();

// -------------------------------------------------
// Navigation and Slider
// -------------------------------------------------
function setUpPrimaryNav() {
  d3.selectAll(".primary-nav").on("click", function() {
    currentPeriod = d3.select(this).attr("data-period");
    renderSlider(currentPeriod);

    var periodDays = daysCount[currentPeriod];
    var totalInstances = Math.floor(allData.length / periodDays);
    if (allData.length % periodDays !== 0) totalInstances++;
    updateForInstance(currentPeriod, totalInstances - 1);
  });
}

function renderSlider(period) {
  d3.select("#sub-nav").html("");
  var periodDays = daysCount[period];
  var totalInstances = Math.floor(allData.length / periodDays);
  if (allData.length % periodDays !== 0) totalInstances++;

  // Label
  d3.select("#sub-nav")
    .append("span")
    .style("margin-right", "10px")
    .text(period.charAt(0).toUpperCase() + period.slice(1) + " instance:");

  // Slider
  d3.select("#sub-nav")
    .append("input")
    .attr("type", "range")
    .attr("min", 0)
    .attr("max", totalInstances - 1)
    .attr("step", 1)
    .attr("value", totalInstances - 1)
    .on("input", function() {
      updateForInstance(period, +this.value);
    });

  // Play Button
  d3.select("#sub-nav")
    .append("button")
    .attr("id", "play-button")
    .style("margin-left", "10px")
    .text("Play")
    .on("click", function() {
      if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
        d3.select(this).text("Play");
      } else {
        d3.select(this).text("Stop");
        playInterval = setInterval(function() {
          var slider = d3.select("#sub-nav input");
          var current = +slider.node().value;
          if (current < totalInstances - 1) {
            current++;
          } else {
            current = 0;
          }
          slider.property("value", current);
          updateForInstance(period, current);
        }, 1000);
      }
    });
}

function updateForInstance(period, instance) {
  var periodDays = daysCount[period];
  var start = instance * periodDays;
  var end   = (instance + 1) * periodDays;
  var sliceData = allData.slice(start, end);
  var aggregatedData = aggregateData(sliceData);
  updateCharts(aggregatedData);
}

// -------------------------------------------------
// Data Aggregation Function
// -------------------------------------------------
function aggregateData(daysArray) {
  var aggregated = {};
  aggregated.accepted_products = d3.sum(daysArray, function(d) { return d.accepted_products; });
  aggregated.rejected_products = d3.sum(daysArray, function(d) { return d.rejected_products; });
  aggregated.total_products = aggregated.accepted_products + aggregated.rejected_products;
  aggregated.production_rejection_percentage =
    (aggregated.rejected_products / aggregated.total_products) * 100;

  // Average production times across workstations
  aggregated.avg_production_time = [];
  var len = daysArray[0].avg_production_time.length;
  for (var i = 0; i < len; i++) {
    aggregated.avg_production_time[i] =
      d3.mean(daysArray, function(d) { return d.avg_production_time[i]; });
  }

  // Occupancy (example, adjust if your data differs)
  aggregated.occupancy_per_workstation = daysArray[0].occupancy_per_workstation;

  return aggregated;
}

// -------------------------------------------------
// Update All Charts and Cards
// -------------------------------------------------
function updateCharts(simulationRecord) {
  updateDonutChart(simulationRecord);
  updateBarChart(simulationRecord);
  updateGaugeChart(simulationRecord);
  updateCircleChart(simulationRecord);
  updateCards(simulationRecord);
}

// -------------------------------------------------
// Update Dashboard Cards
// -------------------------------------------------
function updateCards(aggregatedData) {
  // Card 1: Production Totals
  d3.select(".card:nth-child(1) .card-header p")
    .html("Accepted: <span class=\"highlight\">" + aggregatedData.accepted_products + "</span> | Rejected: <span class=\"highlight\">" + aggregatedData.rejected_products + "</span>");
  d3.select(".card:nth-child(1) .card-content")
    .html("Rejection %: <span class=\"highlight\">" + aggregatedData.production_rejection_percentage.toFixed(2) + "%</span>");

  // Card 2: Workstation Occupancy
  var avgOccupancy = d3.mean(aggregatedData.occupancy_per_workstation) * 100;
  d3.select(".card:nth-child(2) .card-header p")
    .html("Avg Occupancy: <span class=\"highlight\">" + avgOccupancy.toFixed(2) + "%</span>");

  // Card 3: Production Time
  var avgProdTime = d3.mean(aggregatedData.avg_production_time);
  d3.select(".card:nth-child(3) .card-header p")
    .html("Average Time: <span class=\"highlight\">" + avgProdTime.toFixed(2) + " s</span>");

  // Card 4: Delays & Safety (Placeholder)
  d3.select(".card:nth-child(4) .card-header p")
  .html("Avg Delay: <span class=\"highlight\">" + 
        (aggregatedData.avg_delay ? aggregatedData.avg_delay.toFixed(2) : "N/A") + 
        "</span> | Accidents: <span class=\"highlight\">" + 
        (aggregatedData.accidents !== undefined ? aggregatedData.accidents : "N/A") + 
        "</span>");

d3.select(".card:nth-child(4) .card-content")
  .html("Accident Rate: <span class=\"highlight\">" + 
        (aggregatedData.accident_rate ? aggregatedData.accident_rate.toFixed(2) + "%" : "N/A") + 
        "</span>");
}

// -------------------------------------------------
// DONUT CHART: Init & Update
// -------------------------------------------------
function initDonutChart() {
    console.log("Tilin si fuera un camion de helados")
  var width = 400, height = 300;
  donutSvg = d3.select("#chart-area")
    .append("svg")
    .attr("width", width)
    .attr("height", height);
  donutG = donutSvg.append("g")
    .attr("transform", "translate(" + (width / 2) + "," + (height / 2) + ")");
}

function updateDonutChart(simulationRecord) {
  var radius = 100;
  var pieData = [
    { key: "Accepted", value: simulationRecord.accepted_products },
    { key: "Rejected", value: simulationRecord.rejected_products }
  ];
  
  var color = d3.scaleOrdinal()
    .domain(["Accepted", "Rejected"])
    .range(["#7FC8A9", "#F78F8F"]);

  var pie = d3.pie()
    .sort(null)
    .value(function(d) { return d.value; });

  var arc = d3.arc()
    .innerRadius(radius * 0.5)
    .outerRadius(radius);

  var arcs = donutG.selectAll("path.arc")
    .data(pie(pieData), function(d) { return d.data.key; });

  arcs.exit().remove();

  var arcsEnter = arcs.enter()
    .append("path")
    .attr("class", "arc")
    .attr("fill", function(d) { return color(d.data.key); })
    .each(function(d) { this._current = d; });

  arcs = arcsEnter.merge(arcs);

  arcs.transition().duration(1000)
    .attrTween("d", function(d) {
      var i = d3.interpolate(this._current, d);
      this._current = i(0);
      return function(t) {
        return arc(i(t));
      };
    });

  // Mouse events in D3 v4 (function(d), use d3.event for coords)
  arcs.on("mouseover", function(d) {
      tooltip.transition().duration(200).style("opacity", 0.9);
      tooltip.html("<strong>" + d.data.key + ":</strong> " + d.data.value)
        .style("left", (d3.event.pageX + 10) + "px")
        .style("top", (d3.event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      tooltip.transition().duration(500).style("opacity", 0);
    });
}

// -------------------------------------------------
// BAR CHART: Init & Update
// -------------------------------------------------
function initBarChart() {
  var margin = { top: 20, right: 20, bottom: 40, left: 50 };
  var width = 400 - margin.left - margin.right;
  var height = 300 - margin.top - margin.bottom;

  barSvg = d3.select("#bar-chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  barG = barSvg.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
}

function updateBarChart(simulationRecord) {
  var occupancy = simulationRecord.occupancy_per_workstation || [];
  var barData = occupancy.map(function(d, i) {
    return {
      workstation: "W" + (i + 1),
      occupancy: d * 100
    };
  });

  var margin = { top: 20, right: 20, bottom: 40, left: 50 };
  var width = 400 - margin.left - margin.right;
  var height = 300 - margin.top - margin.bottom;

  var xScale = d3.scaleBand()
    .domain(barData.map(function(d) { return d.workstation; }))
    .range([0, width])
    .padding(0.2);
    
  var yScale = d3.scaleLinear()
    .domain([0, d3.max(barData, function(d) { return d.occupancy; }) || 100])
    .range([height, 0])
    .nice();
    
  // Update axes
  barG.selectAll(".x-axis").remove();
  barG.selectAll(".y-axis").remove();
    
  barG.append("g")
    .attr("class", "x-axis")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(xScale));
    
  barG.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(yScale).tickFormat(function(d){ return d + "%"; }));
    
  var bars = barG.selectAll("rect.bar")
    .data(barData, function(d) { return d.workstation; });
  
  bars.exit()
    .transition().duration(500)
    .attr("y", yScale(0))
    .attr("height", 0)
    .remove();
  
  var barsEnter = bars.enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", function(d) { return xScale(d.workstation); })
    .attr("width", xScale.bandwidth())
    .attr("y", yScale(0))
    .attr("height", 0)
    .attr("fill", "#60A5FA")
    .on("mouseover", function(d) {
      tooltip.transition().duration(200).style("opacity", 0.9);
      tooltip.html("<strong>" + d.workstation + ":</strong> " + d.occupancy.toFixed(2) + "%")
        .style("left", (d3.event.pageX + 10) + "px")
        .style("top", (d3.event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      tooltip.transition().duration(500).style("opacity", 0);
    });
  
  bars = barsEnter.merge(bars);
  bars.transition().duration(1000)
    .attr("x", function(d) { return xScale(d.workstation); })
    .attr("width", xScale.bandwidth())
    .attr("y", function(d) { return yScale(d.occupancy); })
    .attr("height", function(d) { return height - yScale(d.occupancy); });
}

// -------------------------------------------------
// GAUGE CHART: Init & Update
// -------------------------------------------------
function initGaugeChart() {
  // Increase the gauge chart size
  var width = 400, height = 300;
  gaugeSvg = d3.select("#gauge-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);
    
  gaugeG = gaugeSvg.append("g")
    .attr("transform", "translate(" + (width / 2) + "," + (height - 20) + ")");
  
  // Add a text element for the percentage
  gaugeG.append("text")
    .attr("class", "gauge-text")
    .attr("dy", "-20")
    .text("0%");
}

function updateGaugeChart(simulationRecord) {
  var rejectionPct = simulationRecord.production_rejection_percentage || 0;

  // For v4, we cannot destructure event => do all with function(d)
  var gaugeScale = d3.scaleLinear()
    .domain([0, 100])
    .range([-Math.PI/2, Math.PI/2]);

  var arcGen = d3.arc()
    .innerRadius(40)
    .outerRadius(60)
    .startAngle(-Math.PI/2);
  
  // Background arc
  var bg = gaugeG.selectAll("path.bg-arc").data([1]);
  bg.enter().append("path")
    .attr("class", "bg-arc")
    .attr("fill", "#e6e6e6")
    .merge(bg)
    .attr("d", arcGen.endAngle(Math.PI/2));
  
  // Foreground arc
  var fg = gaugeG.selectAll("path.fg-arc").data([ rejectionPct ]);
  fg.enter().append("path")
    .attr("class", "fg-arc")
    .attr("fill", "#F88C8C")
    .each(function() { this._current = -Math.PI/2; })
    .merge(fg)
    .transition().duration(1000)
    .attrTween("d", function(d) {
      var currentAngle = this._current;
      var newAngle = gaugeScale(d);
      var i = d3.interpolate(currentAngle, newAngle);
      this._current = newAngle;
      return function(t) {
        return arcGen.endAngle(i(t))();
      };
    });
  
  // Update the percentage text
  gaugeG.select("text.gauge-text")
    .transition().duration(1000)
    .tween("text", function() {
      var self = d3.select(this);
      var currentVal = +self.text().replace("%", "");
      var i = d3.interpolateNumber(currentVal, rejectionPct);
      return function(t) {
        self.text(i(t).toFixed(2) + "%");
      };
    });
  
  // Needle (simplified)
  var needleLength = 60;
  var needle = gaugeG.selectAll("line.needle").data([ rejectionPct ]);
  needle.enter().append("line")
    .attr("class", "needle")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", 0)
    .attr("y2", -needleLength)
    .attr("stroke", "black")
    .attr("stroke-width", 2)
    .each(function() { this._currentRotation = -90; }) // in degrees
    .merge(needle)
    .transition().duration(1000)
    .attrTween("transform", function(d) {
      var currentRotation = this._currentRotation;
      var newRotation = gaugeScale(d) * 180 / Math.PI;
      var i = d3.interpolate(currentRotation, newRotation);
      this._currentRotation = newRotation;
      return function(t) {
        return "rotate(" + i(t) + ")";
      };
    });
}

// -------------------------------------------------
// CIRCLE CHART (Average Production Time): Init & Update
// -------------------------------------------------
function initCircleChart() {
  var width = 400, height = 400;
  circleSvg = d3.select("#prod-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  circleG = circleSvg.append("g")
    .attr("transform", "translate(" + (width / 2) + "," + (height / 2) + ")");

  colorScaleCircle = d3.scaleOrdinal(d3.schemeCategory10);
  arcGenerator = d3.arc();
}

function updateCircleChart(simulationRecord) {
  var avgTimes = simulationRecord.avg_production_time || [];
  var data = avgTimes.map(function(time, i) {
    return {
      workstation: "WS-" + (i + 1),
      time: time
    };
  });

  var totalSegments = data.length;
  var angleStep = totalSegments ? (2 * Math.PI / totalSegments) : 0;
  
  var innerR = 50, maxR = 150;
  var minTime = d3.min(data, function(d) { return d.time; }) || 0;
  var maxTime = d3.max(data, function(d) { return d.time; }) || 1;
  var rScale = d3.scaleLinear()
    .domain([minTime, maxTime])
    .range([innerR, maxR]);

  var arcs = circleG.selectAll("path.circle-arc")
    .data(data, function(d) { return d.workstation; });

  arcs.exit()
    .transition().duration(500)
    .attrTween("d", function(d, i) {
      var r0 = rScale(d.time);
      var rInterpolate = d3.interpolate(r0, innerR);
      return function(t) {
        return arcGenerator
          .innerRadius(innerR)
          .outerRadius(rInterpolate(t))
          .startAngle(i * angleStep)
          .endAngle((i+1) * angleStep)();
      };
    })
    .remove();

  var arcsEnter = arcs.enter().append("path")
    .attr("class", "circle-arc")
    .attr("fill", function(d, i) { return colorScaleCircle(i); })
    .each(function(d) {
      this._oldRadius = innerR; 
    })
    .on("mouseover", function(d) {
      tooltip.transition().duration(200).style("opacity", 0.9);
      tooltip.html("<strong>" + d.workstation + ":</strong> " + d.time.toFixed(2) + " s")
        .style("left", (d3.event.pageX + 10) + "px")
        .style("top", (d3.event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      tooltip.transition().duration(500).style("opacity", 0);
    });

  arcs = arcsEnter.merge(arcs);

  arcs.transition().duration(1000)
    .attrTween("d", function(d, i) {
      var oldRadius = this._oldRadius || innerR;
      var newRadius = rScale(d.time);
      var radiusInterpolate = d3.interpolate(oldRadius, newRadius);
      var startAngle = i * angleStep;
      var endAngle = (i + 1) * angleStep;

      this._oldRadius = newRadius;
      return function(t) {
        return arcGenerator
          .innerRadius(innerR)
          .outerRadius(radiusInterpolate(t))
          .startAngle(startAngle)
          .endAngle(endAngle)();
      };
    });
}