// -------------------------------------------------
// Global Variables and Configuration
// -------------------------------------------------
let allData = [];         // Loaded JSON data
let currentPeriod = "day";
let playInterval;
const daysCount = { day: 1, week: 7, month: 30, year: 365 };

// Global selections for primary charts
let donutSvg, donutG;
let barSvg, barG;
let barStatausSvg, barStatusG;
let barAccidentsSvg, barAccidentsG;
let gaugeSvg, gaugeG;
let circleSvg, circleG;
let arcGenerator, colorScaleCircle;


// Create a single tooltip div
const tooltip = d3.select(".charts-container")
  .append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

// -------------------------------------------------
// Main: Load Data and Initialize (using d3 v5 Promises)
// -------------------------------------------------
function main() {
  d3.json("data/simulation_results_20250410_093155.json")
    .then(data => {
      allData = data;
      setUpPrimaryNav();
      // Initialize the primary charts only once:
      initDonutChart();
      initBarChart();
      initGaugeChart();
      initCircleChart();
      initBarStatus();
      initExtraCharts();
      // Trigger default period ("day"):
      d3.select(".primary-nav[data-period='day']").dispatch("click");
    })
    .catch(error => {
      console.error("Error loading JSON:", error);
    });
}
main();

// -------------------------------------------------
// Navigation and Slider
// -------------------------------------------------
function setUpPrimaryNav() {
  d3.selectAll(".primary-nav").on("click", function () {
    currentPeriod = d3.select(this).attr("data-period");
    renderSlider(currentPeriod);
    const periodDays = daysCount[currentPeriod];
    const totalInstances = Math.ceil(allData.length / periodDays);
    updateForInstance(currentPeriod, totalInstances - 1);
  });
}

function renderSlider(period) {
  d3.select("#sub-nav").html("");
  const periodDays = daysCount[period];
  const totalInstances = Math.ceil(allData.length / periodDays);

  // Label:
  d3.select("#sub-nav")
    .append("span")
    .text(period.charAt(0).toUpperCase() + period.slice(1) + " instance:");

  // Slider:
  d3.select("#sub-nav")
    .append("input")
    .attr("type", "range")
    .attr("min", 0)
    .attr("max", totalInstances - 1)
    .attr("step", 1)
    .attr("value", totalInstances - 1)
    .on("input", function () {
      updateForInstance(period, +this.value);
    });

  // Play Button:
  d3.select("#sub-nav")
    .append("button")
    .text("Play")
    .on("click", function () {
      if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
        d3.select(this).text("Play");
      } else {
        d3.select(this).text("Stop");
        playInterval = setInterval(() => {
          const slider = d3.select("#sub-nav input");
          let current = +slider.node().value;
          current = (current < totalInstances - 1) ? current + 1 : 0;
          slider.property("value", current);
          updateForInstance(period, current);
        }, 1000);
      }
    });
}

function updateForInstance(period, instance) {
  const periodDays = daysCount[period];
  const start = instance * periodDays;
  const end = (instance + 1) * periodDays;
  const sliceData = allData.slice(start, end);
  const aggregatedData = aggregateData(sliceData);
  updateCharts(aggregatedData, sliceData);
}

// -------------------------------------------------
// Data Aggregation (including extra metrics)
// -------------------------------------------------
function aggregateData(daysArray) {
  const aggregated = {};
  aggregated.accepted_products = d3.sum(daysArray, d => d.accepted_products);
  aggregated.rejected_products = d3.sum(daysArray, d => d.rejected_products);
  aggregated.total_products = aggregated.accepted_products + aggregated.rejected_products;
  aggregated.production_rejection_percentage =
    (aggregated.rejected_products / aggregated.total_products) * 100;

  // Average per-workstation values:
  const numWS = daysArray[0].occupancy_per_workstation.length;
  aggregated.occupancy_per_workstation = [];
  for (let i = 0; i < numWS; i++) {
    aggregated.occupancy_per_workstation[i] = d3.mean(daysArray, d => d.occupancy_per_workstation[i]);
  }
  const numTime = daysArray[0].avg_production_time.length;
  aggregated.avg_production_time = [];
  for (let i = 0; i < numTime; i++) {
    aggregated.avg_production_time[i] = d3.mean(daysArray, d => d.avg_production_time[i]);
  }

  // Extra metrics:
  aggregated.avg_delay_time = d3.mean(daysArray, d => d.avg_delay_time);
  aggregated.accident_rate = d3.mean(daysArray, d => d.accident_rate);
  aggregated.supplier_occupancy = d3.mean(daysArray, d => d.supplier_occupancy);
  aggregated.avg_fix_time = d3.mean(daysArray, d => d.avg_fix_time);
  aggregated.avg_bottleneck_delay = d3.mean(daysArray, d => d.avg_bottleneck_delay);
  aggregated.faulty_product_rate = d3.mean(daysArray, d => d.faulty_product_rate);
  aggregated.accidents = d3.sum(daysArray, d => d.accidents);

  if (daysArray[0].workstation_status) {
    aggregated.workstation_status = [];
    const numStatuses = daysArray[0].workstation_status.length;
    for (let i = 0; i < numStatuses; i++) {
      aggregated.workstation_status[i] = {
        operational: d3.mean(daysArray, d => d.workstation_status[i].operational),
        downtime: d3.mean(daysArray, d => d.workstation_status[i].downtime),
        waiting_for_restock: d3.mean(daysArray, d => d.workstation_status[i].waiting_for_restock)
      };
    }
  }

  if (daysArray[0].bottleneck_workstations) {
    aggregated.bottleneck_workstations = {};
    const waitingTimesLength = daysArray[0].bottleneck_workstations.waiting_times.length;
    aggregated.bottleneck_workstations.waiting_times = [];
    for (let i = 0; i < waitingTimesLength; i++) {
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

// -------------------------------------------------
// Update All Charts (Primary + Extra)
// -------------------------------------------------
function updateCharts(aggregatedData, filteredData) {
  updateDonutChart(aggregatedData);
  updateBarChart(aggregatedData);
  updateGaugeChart(aggregatedData);
  updateCircleChart(aggregatedData);
  updateCards(aggregatedData);
  updateBarStatus(filteredData.map(d => d.avg_delay_time));
  updateExtraCharts(filteredData);
}

// -------------------------------------------------
// Update Dashboard Cards
// -------------------------------------------------
function updateCards(aggregatedData) {
  // Card 1: Production Totals
  d3.select(".card:nth-child(1) .card-header p")
    .html("Accepted: <span class='highlight'>" + aggregatedData.accepted_products +
          "</span> | Rejected: <span class='highlight'>" + aggregatedData.rejected_products + "</span>");
  d3.select(".card:nth-child(1) .card-content")
    .html("Rejection %: <span class='highlight'>" + aggregatedData.production_rejection_percentage.toFixed(2) + "%</span>");

  // Card 2: Workstation Occupancy
  const avgOccupancy = d3.mean(aggregatedData.occupancy_per_workstation) * 100;
  d3.select(".card:nth-child(2) .card-header p")
    .html("Avg Occupancy: <span class='highlight'>" + avgOccupancy.toFixed(2) + "%</span>");

  // Card 3: Production Time
  const avgProdTime = d3.mean(aggregatedData.avg_production_time);
  d3.select(".card:nth-child(3) .card-header p")
    .html("Average Time: <span class='highlight'>" + avgProdTime.toFixed(2) + " s</span>");

  // Card 4: Delays & Safety
  d3.select(".card:nth-child(4) .card-header p")
    .html(
      "Avg Delay: <span class=\"highlight\">" + 
      (aggregatedData.avg_delay_time !== undefined 
        ? aggregatedData.avg_delay_time.toFixed(2) 
        : "N/A") + 
      "</span> | Accidents: <span class=\"highlight\">" + 
      (aggregatedData.accidents !== undefined 
        ? aggregatedData.accidents 
        : "N/A") + 
      "</span>"
    );

  d3.select(".card:nth-child(4) .card-content")
    .html(
      "Accident Rate: <span class=\"highlight\">" + 
      (aggregatedData.accident_rate !== undefined 
        ? aggregatedData.accident_rate.toFixed(2) + "%" 
        : "N/A") + 
      "</span>"
    );
}

// -------------------------------------------------
// PRIMARY CHARTS
// -------------------------------------------------

// --- Donut Chart: Accepted vs. Rejected Products ---
function initDonutChart() {
  const width = 400, height = 300;
  donutSvg = d3.select("#chart-area")
    .append("svg")
    .attr("width", width)
    .attr("height", height);
  donutG = donutSvg.append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);
}

function updateDonutChart(data) {
  const radius = 100;
  const pieData = [
    { key: "Accepted", value: data.accepted_products },
    { key: "Rejected", value: data.rejected_products }
  ];

  const color = d3.scaleOrdinal()
    .domain(["Accepted", "Rejected"])
    .range(["#7FC8A9", "#F78F8F"]);

  const pie = d3.pie()
    .sort(null)
    .value(d => d.value);

  const arc = d3.arc()
    .innerRadius(radius * 0.5)
    .outerRadius(radius);

  let arcs = donutG.selectAll("path.arc")
    .data(pie(pieData), d => d.data.key);

  arcs.exit().remove();

  const arcsEnter = arcs.enter()
    .append("path")
    .attr("class", "arc")
    .attr("fill", d => color(d.data.key))
    .each(function(d) { this._current = d; });

  arcs = arcsEnter.merge(arcs);

  arcs.transition().duration(1000)
    .attrTween("d", function(d) {
      const i = d3.interpolate(this._current, d);
      this._current = i(0);
      return t => arc(i(t));
    });

  arcs.on("mouseover", d => {
      tooltip.transition().duration(200).style("opacity", 0.9);
      tooltip.html("<strong>" + d.data.key + ":</strong> " + d.data.value)
        .style("left", (d3.event.pageX + 10) + "px")
        .style("top", (d3.event.pageY - 28) + "px");
    })
    .on("mouseout", () => {
      tooltip.transition().duration(500).style("opacity", 0);
    });
}

// --- Bar Chart: Workstation Occupancy ---
function initBarChart() {
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const width = 400 - margin.left - margin.right;
  const height = 300 - margin.top - margin.bottom;

  barSvg = d3.select("#bar-chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  barG = barSvg.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);
}

function updateBarChart(data) {
  const occupancy = data.occupancy_per_workstation;
  const barData = occupancy.map((d, i) => ({
    workstation: "W" + (i + 1),
    occupancy: d * 100
  }));

  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const width = 400 - margin.left - margin.right;
  const height = 300 - margin.top - margin.bottom;

  const xScale = d3.scaleBand()
    .domain(barData.map(d => d.workstation))
    .range([0, width])
    .padding(0.2);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(barData, d => d.occupancy) || 100])
    .range([height, 0])
    .nice();

  barG.selectAll(".x-axis").remove();
  barG.selectAll(".y-axis").remove();

  barG.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale));

  barG.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(yScale).tickFormat(d => d + "%"));

  let bars = barG.selectAll("rect.bar")
    .data(barData, d => d.workstation);

  bars.exit().transition().duration(500)
    .attr("y", yScale(0))
    .attr("height", 0)
    .remove();

  const barsEnter = bars.enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => xScale(d.workstation))
    .attr("width", xScale.bandwidth())
    .attr("y", yScale(0))
    .attr("height", 0)
    .attr("fill", (d,i) => colorScaleCircle(i))
    .on("mouseover", d => {
      tooltip.transition().duration(200).style("opacity", 0.9);
      tooltip.html("<strong>" + d.workstation + ":</strong> " + d.occupancy.toFixed(2) + "%")
        .style("left", (d3.event.pageX + 10) + "px")
        .style("top", (d3.event.pageY - 28) + "px");
    })
    .on("mouseout", () => {
      tooltip.transition().duration(500).style("opacity", 0);
    });

  bars = barsEnter.merge(bars);

  bars.transition().duration(1000)
    .attr("x", d => xScale(d.workstation))
    .attr("width", xScale.bandwidth())
    .attr("y", d => yScale(d.occupancy))
    .attr("height", d => height - yScale(d.occupancy));
}

// --- Gauge Chart: Production Rejection Percentage ---
function initGaugeChart() {
  const width = 400, height = 300;
  gaugeSvg = d3.select("#gauge-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  gaugeG = gaugeSvg.append("g")
    .attr("transform", `translate(${width / 2}, ${ height/1.5})`);

  gaugeG.append("text")
    .attr("class", "gauge-text")
    .attr("dy", "-20")
    .text("0%");
}

function updateGaugeChart(data) {
  const rejectionPct = data.production_rejection_percentage;
  const gaugeScale = d3.scaleLinear()
    .domain([0, 100])
    .range([-Math.PI / 2, Math.PI / 2]);

  const arcGen = d3.arc()
    .innerRadius(80)
    .outerRadius(100)
    .startAngle(-Math.PI / 2);

  const bg = gaugeG.selectAll("path.bg-arc").data([1]);
  bg.enter().append("path")
    .attr("class", "bg-arc")
    .attr("fill", "#e6e6e6")
    .merge(bg)
    .attr("d", arcGen.endAngle(Math.PI / 2));

  const fg = gaugeG.selectAll("path.fg-arc").data([rejectionPct]);
  fg.enter().append("path")
    .attr("class", "fg-arc")
    .attr("fill", "#F88C8C")
    .each(function () { this._current = -Math.PI / 2; })
    .merge(fg)
    .transition().duration(1000)
    .attrTween("d", function(d) {
      const currentAngle = this._current;
      const newAngle = gaugeScale(d);
      const i = d3.interpolate(currentAngle, newAngle);
      this._current = newAngle;
      return t => arcGen.endAngle(i(t))();
    });

  gaugeG.select("text.gauge-text")
    .transition().duration(1000)
    .tween("text", function () {
      const self = d3.select(this);
      const currentVal = +self.text().replace("%", "");
      const i = d3.interpolateNumber(currentVal, rejectionPct);
      return t => { self.text(i(t).toFixed(2) + "%"); };
    });

  const needleLength = 100;
  const needle = gaugeG.selectAll("line.needle").data([rejectionPct]);
  needle.enter().append("line")
    .attr("class", "needle")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", 0)
    .attr("y2", -needleLength)
    .attr("stroke", "black")
    .attr("stroke-width", 2)
    .each(function () { this._currentRotation = -90; })
    .merge(needle)
    .transition().duration(1000)
    .attrTween("transform", function(d) {
      const currentRotation = this._currentRotation;
      const newRotation = gaugeScale(d) * 180 / Math.PI;
      const i = d3.interpolate(currentRotation, newRotation);
      this._currentRotation = newRotation;
      return t => `rotate(${i(t)})`;
    });
}

// --- Circle Chart: Average Production Time per Workstation ---
function initCircleChart() {
  const width = 400, height = 400;
  circleSvg = d3.select("#prod-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  circleG = circleSvg.append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

  colorScaleCircle = d3.scaleOrdinal(d3.schemeCategory10);
  arcGenerator = d3.arc();
}

function updateCircleChart(simulationRecord) {
  // Extract or compute data
  var avgTimes = simulationRecord.avg_production_time || [];
  var data = avgTimes.map(function(time, i) {
    return {
      workstation: "WS-" + (i + 1),
      time: time
    };
  });

  // Chart geometry constants
  var innerR = 50;
  var maxR = 150;         // max possible radius
  var minThickness = 10;  // <--- Our forced minimum thickness

  // Scale to map production times to outer radius
  var minTime = d3.min(data, d => d.time) || 0;
  var maxTime = d3.max(data, d => d.time) || 1;
  var rScale = d3.scaleLinear()
    .domain([minTime, maxTime])
    .range([innerR, maxR]);

  // Each arc is a segment around the circle
  var totalSegments = data.length;
  var angleStep = totalSegments ? (2 * Math.PI / totalSegments) : 0;

  // Helper to clamp the outer radius so arcs are always visible
  function getOuterRadius(time) {
    var scaled = rScale(time);
    // If scaled is too close to innerR, ensure at least "minThickness"
    if (scaled < innerR + minThickness) {
      return innerR + minThickness;
    }
    return scaled;
  }

  // Join data
  var arcs = circleG.selectAll("path.circle-arc")
    .data(data, d => d.workstation);

  // EXIT
  arcs.exit()
    .transition().duration(500)
    .attrTween("d", function(d, i) {
      // Start from the current outer radius,
      // go down to the innerR (arc disappears).
      var r0 = getOuterRadius(d.time);
      var rInterpolate = d3.interpolate(r0, innerR);

      return function(t) {
        return arcGenerator
          .innerRadius(innerR)
          .outerRadius(rInterpolate(t))
          .startAngle(i * angleStep)
          .endAngle((i + 1) * angleStep)();
      };
    })
    .remove();

  // ENTER
  var arcsEnter = arcs.enter().append("path")
    .attr("class", "circle-arc")
    .attr("fill", (d, i) => colorScaleCircle(i))
    .each(function(d) {
      // Store the "old" radius as just innerR
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

  // MERGE
  arcs = arcsEnter.merge(arcs);

  // UPDATE
  arcs.transition().duration(1000)
    .attrTween("d", function(d, i) {
      // Animate from oldRadius to new clamped outer radius
      var oldRadius = this._oldRadius || innerR;
      var newRadius = getOuterRadius(d.time);
      var radiusInterpolate = d3.interpolate(oldRadius, newRadius);

      // Save new radius for next transition
      this._oldRadius = newRadius;

      return function(t) {
        return arcGenerator
          .innerRadius(innerR)
          .outerRadius(radiusInterpolate(t))
          .startAngle(i * angleStep)
          .endAngle((i + 1) * angleStep)();
      };
    });
}



// -------------------------------------------------
// EXTRA CHARTS (Additional Graphs)
// // -------------------------------------------------
// function updateExtraCharts(filteredData) {
//   // Clear extra charts containers:
//   d3.select("#accident-rate").selectAll("svg").remove();
//   d3.select("#workstation-status").selectAll("svg").remove();
//   d3.select("#bottleneck-waiting-times").selectAll("svg").remove();
//   d3.select("#supplier-metrics").selectAll("svg").remove();

//   const newChartMargin = { top: 20, right: 50, bottom: 20, left: 50 },
//         newChartWidth = 650 - newChartMargin.left - newChartMargin.right,
//         newChartHeight = 400 - newChartMargin.top - newChartMargin.bottom;


//   // 2. Accident Rate (Column Chart)
//   const accidentRates = filteredData.map(d => d.accident_rate);
//   const svg2 = d3.select("#accident-rate").append("svg")
//       .attr("width", newChartWidth + newChartMargin.left + newChartMargin.right)
//       .attr("height", newChartHeight + newChartMargin.top + newChartMargin.bottom)
//     .append("g")
//       .attr("transform", `translate(${newChartMargin.left}, ${newChartMargin.top})`);
//   drawColumnChart(accidentRates, svg2, "Accident Rate per Day (%)", "#FFA07A", newChartWidth, newChartHeight);

//   // 3. Workstation Status (Stacked Bar Chart)
//   const lastIteration = filteredData[filteredData.length - 1];
//   const workstationStatusData = lastIteration.workstation_status.map((d, i) => ({
//       workstation: "Workstation " + (i + 1),
//       operational: d.operational,
//       downtime: d.downtime,
//       waiting_for_restock: d.waiting_for_restock
//   }));
//   const svg3 = d3.select("#workstation-status").append("svg")
//       .attr("width", newChartWidth + newChartMargin.left + newChartMargin.right)
//       .attr("height", newChartHeight + newChartMargin.top + newChartMargin.bottom)
//     .append("g")
//       .attr("transform", `translate(${newChartMargin.left}, ${newChartMargin.top})`);
//   drawWorkstationStatusChart(workstationStatusData, svg3, "Workstation Status Distribution", newChartWidth, newChartHeight);

//   // 4. Bottleneck Waiting Times (Line Chart)
//   const waitingTimesData = filteredData.map(d => d.bottleneck_workstations.waiting_times);
//   const svg4 = d3.select("#bottleneck-waiting-times").append("svg")
//       .attr("width", newChartWidth + newChartMargin.left + newChartMargin.right)
//       .attr("height", newChartHeight + newChartMargin.top + newChartMargin.bottom)
//     .append("g")
//       .attr("transform", `translate(${newChartMargin.left}, ${newChartMargin.top})`);
//   drawWaitingTimesLineChart(waitingTimesData, svg4, "Waiting Times per Station Across Iterations", newChartWidth, newChartHeight);

//   // 5. Supplier Metrics (Composite Chart)
//   const supplierOccupancy = filteredData.map(d => d.supplier_occupancy);
//   const avgFixTimes = filteredData.map(d => d.avg_fix_time);
//   const svg5 = d3.select("#supplier-metrics").append("svg")
//       .attr("width", newChartWidth + newChartMargin.left + newChartMargin.right)
//       .attr("height", newChartHeight + newChartMargin.top + newChartMargin.bottom)
//     .append("g")
//       .attr("transform", `translate(${newChartMargin.left}, ${newChartMargin.top})`);
//   drawSupplierMetricsChart(supplierOccupancy, avgFixTimes, svg5, "Supplier Metrics", newChartWidth, newChartHeight);
// }

function initBarStatus() {
  const width = 600, height = 300;
  barStatausSvg = d3.select("#average-delay-time")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  barStatusG = barStatausSvg.append("g")
    .attr("transform",  `translate(${40 }, ${20})`);
}
// -------------------------------------------------
// Extra Chart Drawing Functions
// -------------------------------------------------
function updateBarStatus(values) {
  const chartData = values.map((value, index) => ({ index: index + 1, value: value }));
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartWidth = 600 - margin.left - margin.right;
  const chartHeight = 300 - margin.top - margin.bottom;
  const x = d3.scaleBand()
      .domain(chartData.map(d => d.index))
      .range([0, chartWidth])
      .padding(0.2);
  const y = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d.value)])
      .nice()
      .range([chartHeight, 0]);
  
  barStatusG.selectAll(".x axis").remove();
  barStatusG.selectAll(".y axis").remove();
  barStatusG.append("g")
      .attr("class", "x axis")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(x).tickSize(0));
  barStatusG.append("g")
      .attr("class", "y axis")
      .call(d3.axisLeft(y));

  let bars = barStatusG.selectAll(".bar").data(chartData);

  bars.exit().transition().duration(500)
      .attr("y", y(0))
      .attr("height", 0)
      .remove();

  const barsEnter = bars.enter().append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.index))
      .attr("y", y(0))
      .attr("width", x.bandwidth())
      .attr("height", 0)
      .attr("fill", "#69b3a2")
      .on("mouseover", d => {
        tooltip.transition().duration(200)
            .style("opacity", 0.9);
        tooltip.html("Iteration " + d.index + "<br>Value: " + d.value.toFixed(2))
            .style("left", (d3.event.pageX + 10) + "px")
            .style("top", (d3.event.pageY - 28) + "px");
     })
     .on("mouseout", () => {
        tooltip.transition().duration(500).style("opacity", 0);
     });
  
  bars = barsEnter.merge(bars);

  bars.transition().duration(1000)
      .attr("x", d => x(d.index))
      .attr("width", x.bandwidth())
      .attr("y", d => y(d.value))
      .attr("height", d => chartHeight - y(d.value));

}

function drawColumnChart(values, container, title, color, chartWidth, chartHeight) {
  const chartData = values.map((value, index) => ({ index: index + 1, value: value }));
  const x = d3.scaleBand()
      .domain(chartData.map(d => d.index))
      .range([0, chartWidth])
      .padding(0.2);
  const y = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d.value)])
      .nice()
      .range([chartHeight, 0]);
  container.append("g")
      .attr("class", "x axis")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(x).tickSize(0));
  container.append("g")
      .attr("class", "y axis")
      .call(d3.axisLeft(y));
  container.selectAll(".column")
      .data(chartData)
      .enter().append("rect")
      .attr("class", "column")
      .attr("x", d => x(d.index))
      .attr("y", d => y(d.value))
      .attr("width", x.bandwidth())
      .attr("height", d => chartHeight - y(d.value))
      .attr("fill", color);
}

function drawWaitingTimesLineChart(waitingTimesData, container, title, chartWidth, chartHeight) {
  const iterations = waitingTimesData.length;
  const stationCount = waitingTimesData[0].length;
  const color = d3.scaleOrdinal(d3.schemeCategory10);
  const stationsData = [];
  for (let i = 0; i < stationCount; i++) {
    stationsData.push({
      station: "Station " + (i + 1),
      values: waitingTimesData.map((d, iter) => ({ iteration: iter + 1, value: d[i] }))
    });
  }
  const x = d3.scaleLinear()
      .domain([1, iterations])
      .range([0, chartWidth]);
  const y = d3.scaleLog()
      .domain([1, d3.max(waitingTimesData.flat())])
      .range([chartHeight, 0]);
  container.append("g")
      .attr("class", "x axis")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(x).ticks(iterations).tickFormat(d3.format("d")));
  container.append("g")
      .attr("class", "y axis")
      .call(d3.axisLeft(y).ticks(5, ".1s"));

  const line = d3.line()
      .x(d => x(d.iteration))
      .y(d => y(d.value));

  const stations = container.selectAll(".station")
      .data(stationsData)
      .enter().append("g")
      .attr("class", "station");

  stations.append("path")
      .attr("class", "line")
      .attr("d", d => line(d.values))
      .attr("stroke", d => color(d.station))
      .attr("fill", "none")
      .attr("stroke-width", 2);

  stations.append("text")
      .datum(d => ({ station: d.station, value: d.values[d.values.length - 1] }))
      .attr("transform", d => `translate(${x(d.value.iteration)}, ${y(d.value.value)})`)
      .attr("x", 5)
      .attr("dy", "0.35em")
      .text(d => d.station)
      .style("font-size", "10px")
      .attr("fill", d => color(d.station));
}

function drawWorkstationStatusChart(data, container, title, chartWidth, chartHeight) {
  const statusKeys = ["operational", "downtime", "waiting_for_restock"];
  const stack = d3.stack().keys(statusKeys);
  const series = stack(data);
  const x = d3.scaleBand()
      .domain(data.map(d => d.workstation))
      .range([0, chartWidth - 80])
      .padding(0.2);
  const yExtent = [0, d3.max(series, serie => d3.max(serie, d => d[1]))];
  const y = d3.scaleLinear()
      .domain(yExtent)
      .nice()
      .range([chartHeight, 0]);
  container.append("g")
      .attr("class", "x axis")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(x));
  container.append("g")
      .attr("class", "y axis")
      .call(d3.axisLeft(y));
  const color = d3.scaleOrdinal()
      .domain(statusKeys)
      .range(["#4daf4a", "#e41a1c", "#377eb8"]);
  const groups = container.selectAll(".serie")
      .data(series)
      .enter().append("g")
      .attr("class", "serie")
      .attr("fill", d => color(d.key));
  groups.selectAll("rect")
      .data(d => d)
      .enter().append("rect")
      .attr("x", (d, i) => x(data[i].workstation))
      .attr("y", d => y(d[1]))
      .attr("height", d => y(d[0]) - y(d[1]))
      .attr("width", x.bandwidth())
      .on("mouseover", function(d) {
         const key = d3.select(this.parentNode).datum().key;
         const value = d.data[key];
         tooltip.transition().duration(200)
             .style("opacity", 0.9);
         tooltip.html("<strong>" + d.data.workstation + "</strong><br>" + key + ": " + value.toFixed(2))
             .style("left", (d3.event.pageX + 10) + "px")
             .style("top", (d3.event.pageY - 28) + "px");
      })
      .on("mouseout", () => {
         tooltip.transition().duration(500).style("opacity", 0);
      });
  const legend = container.append("g")
      .attr("transform", `translate(${chartWidth - 80}, 20)`);
  statusKeys.forEach((key, i) => {
    const legendItem = legend.append("g")
        .attr("transform", `translate(0, ${i * 20})`);
    legendItem.append("rect")
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", color(key));
    legendItem.append("text")
        .attr("x", 20)
        .attr("y", 12)
        .text(key.replace(/_/g, " "))
        .style("font-size", "12px");
  });
}

function drawSupplierMetricsChart(occupancyData, fixTimeData, container, title, chartWidth, chartHeight) {
  const smallWidth = chartWidth / 2 - 20;
  const smallHeight = chartHeight / 2;
  const smallMargin = { top: 30, right: 20, bottom: 40, left: 50 };
  const occupancyChartData = occupancyData.map((d, i) => ({ iteration: i + 1, value: d * 100 }));
  const fixTimeChartData = fixTimeData.map((d, i) => ({ iteration: i + 1, value: d }));
  const occupancyGroup = container.append("g")
      .attr("transform", `translate(0, ${smallMargin.top})`);
  const fixTimeGroup = container.append("g")
      .attr("transform", `translate(${smallWidth + 40}, ${smallMargin.top})`);
  
  drawSmallChart(occupancyGroup, occupancyChartData, smallWidth, smallHeight, "Supplier Occupancy (%)", "#8884d8", smallMargin);
  drawSmallChart(fixTimeGroup, fixTimeChartData, smallWidth, smallHeight, "Average Fix Time (seconds)", "#82ca9d", smallMargin);
  
  function drawSmallChart(group, chartData, chartWidth, chartHeight, chartTitle, color, margin) {
    const x = d3.scaleBand()
        .domain(chartData.map(d => d.iteration))
        .range([0, chartWidth])
        .padding(0.2);
    const y = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d.value) * 1.1])
        .nice()
        .range([chartHeight, 0]);
    group.append("g")
        .attr("class", "x axis")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));
    group.append("g")
        .attr("class", "y axis")
        .call(d3.axisLeft(y));
    group.append("text")
        .attr("x", chartWidth / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .attr("class", "axis-title")
        .text(chartTitle);
    group.selectAll(".bar")
        .data(chartData)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.iteration))
        .attr("y", d => y(d.value))
        .attr("width", x.bandwidth())
        .attr("height", d => chartHeight - y(d.value))
        .attr("fill", color)
        .on("mouseover", d => {
          tooltip.transition().duration(200)
              .style("opacity", 0.9);
          tooltip.html("Iteration " + d.iteration + "<br>Value: " + d.value.toFixed(2))
              .style("left", (d3.event.pageX + 10) + "px")
              .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", () => {
          tooltip.transition().duration(500).style("opacity", 0);
        });
    group.selectAll(".bar-label")
        .data(chartData)
        .enter().append("text")
        .attr("x", d => x(d.iteration) + x.bandwidth() / 2)
        .attr("y", d => y(d.value) - 5)
        .attr("text-anchor", "middle")
        .text(d => d.value.toFixed(2))
        .style("font-size", "10px")
        .style("fill", "#333");
  }
}

// -------------------------------------------------
// EXTRA CHARTS STANDARDIZED: Initialization & Update
// -------------------------------------------------

// Containers and globals
const extraCharts = {
  accidentRate: {},
  workstationStatus: {},
  bottleneckTimes: {},
  supplierMetrics: {}
};

// -------------------------------------------------
// Initialize all extra charts once
// -------------------------------------------------
function initExtraCharts() {
  initAccidentRateChart();
  initWorkstationStatusChart();
  initBottleneckTimesChart();
  initSupplierMetricsChart();
}

// -------------------------------------------------
// Update all extra charts
// -------------------------------------------------
function updateExtraCharts(filteredData) {
  // Prepare data
  const accidentRates = filteredData.map(d => d.accident_rate);
  const lastStatus = filteredData[filteredData.length - 1].workstation_status;
  const waitingTimes = filteredData.map(d => d.bottleneck_workstations.waiting_times);
  const supplierOccupancy = filteredData.map(d => d.supplier_occupancy);
  const avgFixTimes = filteredData.map(d => d.avg_fix_time);

  // Call updates
  updateAccidentRateChart(accidentRates);
  updateWorkstationStatusChart(lastStatus);
  updateBottleneckTimesChart(waitingTimes);
  updateSupplierMetricsChart(supplierOccupancy, avgFixTimes);
}

// -------------------------------------------------
// Accident Rate (Column Chart)
// -------------------------------------------------
function initAccidentRateChart() {
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };
  const width = 650 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;
  const svg = d3.select('#accident-rate')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

  extraCharts.accidentRate = { svg, margin, width, height };
  // Initial axes
  svg.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${height})`);
  svg.append('g').attr('class', 'y-axis');
}

function updateAccidentRateChart(data) {
  const { svg, width, height } = extraCharts.accidentRate;
  const x = d3.scaleBand()
      .domain(data.map((_, i) => i + 1))
      .range([0, width])
      .padding(0.2);
  const y = d3.scaleLinear()
      .domain([0, d3.max(data) || 1])
      .nice()
      .range([height, 0]);

  // Update axes with smooth transitions (1s duration)
  svg.select('.x-axis')
      .transition().duration(1000)
      .call(d3.axisBottom(x).tickSize(0));
  svg.select('.y-axis')
      .transition().duration(1000)
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + '%'));

  // Data join
  const bars = svg.selectAll('rect.bar')
      .data(data, (_, i) => i);

  // EXIT: Smooth transition out
  bars.exit()
      .transition().duration(1000)
      .attr('y', y(0))
      .attr('height', 0)
      .remove();

  // ENTER
  const barsEnter = bars.enter().append('rect')
      .attr('class', 'bar')
      .attr('x', (_, i) => x(i + 1))
      .attr('width', x.bandwidth())
      .attr('y', y(0))
      .attr('height', 0)
      .attr('fill', '#69b3a2');

  // UPDATE + ENTER with smooth transitions
  barsEnter.merge(bars)
      .transition().duration(1000)
      .attr('x', (_, i) => x(i + 1))
      .attr('width', x.bandwidth())
      .attr('y', d => y(d))
      .attr('height', d => height - y(d));
}


// -------------------------------------------------
// Workstation Status (Stacked Bar Chart)
// -------------------------------------------------
function initWorkstationStatusChart() {
  const margin = { top: 20, right: 50, bottom: 30, left: 50 };
  const width = 650 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;
  const svg = d3.select('#workstation-status')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

  extraCharts.workstationStatus = { svg, margin, width, height };
  svg.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${height})`);
  svg.append('g').attr('class', 'y-axis');
  svg.append('g').attr('class', 'legend').attr('transform', `translate(${width + 20},0)`);
}

function updateWorkstationStatusChart(statusArray) {
  const { svg, width, height } = extraCharts.workstationStatus;
  const keys = ['operational', 'downtime', 'waiting_for_restock'];
  const data = statusArray.map((d, i) => ({ workstation: 'W' + (i + 1), ...d }));
  const stackGen = d3.stack().keys(keys);
  const series = stackGen(data);

  const x = d3.scaleBand()
      .domain(data.map(d => d.workstation))
      .range([0, width - 80])
      .padding(0.2);
  const y = d3.scaleLinear()
      .domain([0, d3.max(series, s => d3.max(s, d => d[1]))])
      .nice()
      .range([height, 0]);

  // Smooth axes update (1s duration)
  svg.select('.x-axis').transition().duration(1000).call(d3.axisBottom(x));
  svg.select('.y-axis').transition().duration(1000).call(d3.axisLeft(y));

  const color = d3.scaleOrdinal().domain(keys).range(d3.schemeCategory10);

  // Data join for layers
  const groups = svg.selectAll('g.layer')
      .data(series, d => d.key);
  groups.exit().remove();
  const groupsEnter = groups.enter().append('g')
      .attr('class', 'layer')
      .attr('fill', d => color(d.key));
  const layer = groupsEnter.merge(groups);

  // Data join for rects
  const rects = layer.selectAll('rect')
      .data(d => d, d => d.data.workstation);
  rects.exit()
      .transition().duration(1000)
      .attr('height', 0)
      .attr('y', y(0))
      .remove();

  const rectsEnter = rects.enter().append('rect')
      .attr('x', d => x(d.data.workstation))
      .attr('width', x.bandwidth())
      .attr('y', y(0))
      .attr('height', 0);
  rectsEnter.merge(rects)
      .transition().duration(1000)
      .attr('x', d => x(d.data.workstation))
      .attr('width', x.bandwidth())
      .attr('y', d => y(d[1]))
      .attr('height', d => y(d[0]) - y(d[1]));

  // Update legend (static; no transition needed)
  const legend = svg.select('.legend').selectAll('g').data(keys);
  const legendEnter = legend.enter().append('g')
      .attr('transform', (_, i) => `translate(-100,${i * 20})`);
  legendEnter.append('rect')
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', d => color(d));
  legendEnter.append('text')
      .attr('x', 20)
      .attr('y', 12)
      .text(d => d.replace(/_/g, ' '))
      .style('font-size', '12px');
}


// -------------------------------------------------
// Bottleneck Waiting Times (Line Chart)
// -------------------------------------------------
function initBottleneckTimesChart() {
  const margin = { top: 20, right: 100, bottom: 30, left: 50 };
  const width = 650 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;
  const svg = d3.select('#bottleneck-waiting-times')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

  extraCharts.bottleneckTimes = { svg, margin, width, height };
  svg.append('g').attr('class','x-axis').attr('transform',`translate(0,${height})`);
  svg.append('g').attr('class','y-axis');
}

function updateBottleneckTimesChart(waitingData) {
  const { svg, width, height } = extraCharts.bottleneckTimes;
  const iterations = waitingData.length;
  const stationCount = waitingData[0]?.length || 0;

  const x = d3.scaleLinear().domain([1, iterations]).range([0, width]);
  const y = d3.scaleLog()
      .domain([1, d3.max(waitingData.flat())])
      .range([height, 0]);

  // Smooth axes updates (1s duration)
  svg.select('.x-axis')
      .transition().duration(1000)
      .call(d3.axisBottom(x).ticks(iterations).tickFormat(d3.format('d')));
  svg.select('.y-axis')
      .transition().duration(1000)
      .call(d3.axisLeft(y).ticks(5, '.1s'));

  // Prepare series for each station
  const stations = d3.range(stationCount).map(i => ({
      id: i,
      values: waitingData.map((d, j) => ({ x: j + 1, y: d[i] }))
  }));

  const color = d3.scaleOrdinal().domain(stations.map(s => s.id)).range(d3.schemeCategory10);
  const lineGen = d3.line().x(d => x(d.x)).y(d => y(d.y));

  // Data join for lines
  const lines = svg.selectAll('path.line').data(stations, d => d.id);
  lines.exit().remove();
  const linesEnter = lines.enter().append('path')
      .attr('class', 'line')
      .attr('fill', 'none');
  linesEnter.merge(lines)
      .transition().duration(1000)
      .attr('stroke', d => color(d.id))
      .attr('d', d => lineGen(d.values));
}


// -------------------------------------------------
// Supplier Metrics (Two small column charts)
// -------------------------------------------------
function initSupplierMetricsChart() {
  const margin = { top: 30, right: 20, bottom: 40, left: 50 };
  const width = 650 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;
  const svg = d3.select('#supplier-metrics')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

  // Two groups
  const halfWidth = (width - 40) / 2;
  svg.append('g').attr('class','occupancy').attr('transform','translate(0,0)');
  svg.append('g').attr('class','fixTime').attr('transform',`translate(${halfWidth+40},0)`);

  extraCharts.supplierMetrics = { svg, margin, width: halfWidth, height, groups: { occupancy: svg.select('.occupancy'), fixTime: svg.select('.fixTime') } };

  // Axes groups
  extraCharts.supplierMetrics.groups.occupancy.append('g').attr('class','x-axis').attr('transform',`translate(0,${height- margin.bottom})`);
  extraCharts.supplierMetrics.groups.occupancy.append('g').attr('class','y-axis');
  extraCharts.supplierMetrics.groups.fixTime.append('g').attr('class','x-axis').attr('transform',`translate(0,${height- margin.bottom})`);
  extraCharts.supplierMetrics.groups.fixTime.append('g').attr('class','y-axis');
}

function updateSupplierMetricsChart(occupancyData, fixTimeData) {
  const { groups, width, height } = extraCharts.supplierMetrics;
  // Occupancy: using a non-black color (example: "#8884d8")
  const occVals = occupancyData.map((v, i) => ({ x: i + 1, y: v * 100 }));
  updateSmallColumn(groups.occupancy, occVals, width, height, 'Supplier Occupancy (%)', "#8884d8");
  
  // Fix Time: using a non-black color (example: "#82ca9d")
  const fixVals = fixTimeData.map((v, i) => ({ x: i + 1, y: v }));
  updateSmallColumn(groups.fixTime, fixVals, width, height, 'Average Fix Time (s)', "#82ca9d");
}

function updateSmallColumn(container, data, width, height, title, barColor) {
  const x = d3.scaleBand().domain(data.map(d => d.x)).range([0, width]).padding(0.2);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.y) || 1]).nice().range([height - 40, 0]);

  container.select('.x-axis')
      .transition().duration(1000)
      .call(d3.axisBottom(x).tickFormat(d3.format('d')));
  container.select('.y-axis')
      .transition().duration(1000)
      .call(d3.axisLeft(y));

  let t = container.selectAll('text.chart-title').data([title]);
  t.enter().append('text')
      .attr('class', 'chart-title')
      .attr('x', width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
    .merge(t)
      .text(title);

  // Data join for bars
  const bars = container.selectAll('rect.bar').data(data, d => d.x);
  bars.exit()
      .transition().duration(1000)
      .attr('y', y(0))
      .attr('height', 0)
      .remove();

  const barsEnter = bars.enter().append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.x))
      .attr('width', x.bandwidth())
      .attr('y', y(0))
      .attr('height', 0)
      .attr('fill', barColor);

  barsEnter.merge(bars)
      .transition().duration(1000)
      .attr('x', d => x(d.x))
      .attr('width', x.bandwidth())
      .attr('y', d => y(d.y))
      .attr('height', d => height - 40 - y(d.y))
      .attr('fill', barColor);
}


// -------------------------------------------------
// Usage: call initExtraCharts() once in main, and keep updateExtraCharts in render flow
// -------------------------------------------------
