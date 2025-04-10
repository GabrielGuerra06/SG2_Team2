let allData = [];         
let currentPeriod = "day";
let playInterval;
const daysCount = { day: 1, week: 7, month: 30, year: 365 };

let donutSvg, donutG;
let barSvg, barG;
let barStatausSvg, barStatusG;
let gaugeSvg, gaugeG;
let circleSvg, circleG;
let arcGenerator, colorScaleCircle;

const tooltip = d3.select(".charts-container")
  .append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

function main() {
  d3.json("data/simulation_results_20250410_093155.json")
    .then(data => {
      allData = data;
      setUpPrimaryNav();
      initDonutChart();
      initBarChart();
      initGaugeChart();
      initCircleChart();
      initBarStatus();
      initExtraCharts();
      d3.select(".primary-nav[data-period='day']").dispatch("click");
    })
    .catch(error => {
      console.error("Error loading JSON:", error);
    });
}
main();

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

  d3.select("#sub-nav")
    .append("span")
    .text(period.charAt(0).toUpperCase() + period.slice(1) + " instance:");

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

  // Update the indicator in the navbar using 1-indexing for readability
  d3.select("#time-indicator")
    .html(`<b>${period.charAt(0).toUpperCase() + period.slice(1)} ${instance + 1}</b>`);
}

function aggregateData(daysArray) {
  const aggregated = {};
  aggregated.accepted_products = d3.sum(daysArray, d => d.accepted_products);
  aggregated.rejected_products = d3.sum(daysArray, d => d.rejected_products);
  aggregated.total_products = aggregated.accepted_products + aggregated.rejected_products;
  aggregated.production_rejection_percentage =
    (aggregated.rejected_products / aggregated.total_products) * 100;

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

function updateCharts(aggregatedData, filteredData) {
  updateDonutChart(aggregatedData);
  updateBarChart(aggregatedData);
  updateGaugeChart(aggregatedData);
  updateCircleChart(aggregatedData);
  updateCards(aggregatedData);
  updateBarStatus(filteredData.map(d => d.avg_delay_time));
  updateExtraCharts(filteredData);
}

function updateCards(aggregatedData) {
  d3.select(".card:nth-child(1) .card-header p")
    .html("Accepted: <span class='highlight'>" + aggregatedData.accepted_products +
          "</span> | Rejected: <span class='highlight'>" + aggregatedData.rejected_products + "</span>");
  d3.select(".card:nth-child(1) .card-content")
    .html("Rejection %: <span class='highlight'>" + aggregatedData.production_rejection_percentage.toFixed(2) + "%</span>");

  const avgOccupancy = d3.mean(aggregatedData.occupancy_per_workstation) * 100;
  d3.select(".card:nth-child(2) .card-header p")
    .html("Avg Occupancy: <span class='highlight'>" + avgOccupancy.toFixed(2) + "%</span>");

  const avgProdTime = d3.mean(aggregatedData.avg_production_time);
  d3.select(".card:nth-child(3) .card-header p")
    .html("Average Time: <span class='highlight'>" + avgProdTime.toFixed(2) + " s</span>");

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

function initDonutChart() {
  const width = 400, height = 300;
  donutSvg = d3.select("#chart-area")
    .append("svg")
    .attr("width", width)
    .attr("height", height);
  donutG = donutSvg.append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

  // Add legend group for Donut Chart
  donutSvg.append("g")
    .attr("class", "donut-legend")
    .attr("transform", `translate(${10}, ${height - 40})`);
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

  // Update legend for Donut Chart
  const legend = donutSvg.select(".donut-legend").selectAll("g")
      .data(pieData);
  const legendEnter = legend.enter().append("g")
      .attr("transform", (d, i) => `translate(${i * 100}, 0)`);
  
  legendEnter.append("rect")
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", d => color(d.key));
  
  legendEnter.append("text")
      .attr("x", 20)
      .attr("y", 12)
      .text(d => d.key)
      .style("font-size", "12px");
  
  legend.exit().remove();
}

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

  // Add legend group for Circle Chart
  circleSvg.append("g")
    .attr("class", "circle-legend")
    .attr("transform", `translate(${width - 120},20)`);
}

function updateCircleChart(simulationRecord) {
  var avgTimes = simulationRecord.avg_production_time || [];
  var data = avgTimes.map(function(time, i) {
    return {
      workstation: "W" + (i + 1),
      time: time
    };
  });

  var innerR = 50;
  var maxR = 150;
  var minThickness = 10;  
  var minTime = d3.min(data, d => d.time) || 0;
  var maxTime = d3.max(data, d => d.time) || 1;
  var rScale = d3.scaleLinear()
    .domain([minTime, maxTime])
    .range([innerR, maxR]);

  var totalSegments = data.length;
  var angleStep = totalSegments ? (2 * Math.PI / totalSegments) : 0;

  function getOuterRadius(time) {
    var scaled = rScale(time);
    if (scaled < innerR + minThickness) {
      return innerR + minThickness;
    }
    return scaled;
  }

  var arcs = circleG.selectAll("path.circle-arc")
    .data(data, d => d.workstation);

  arcs.exit()
    .transition().duration(500)
    .attrTween("d", function(d, i) {
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

  var arcsEnter = arcs.enter().append("path")
    .attr("class", "circle-arc")
    .attr("fill", (d, i) => colorScaleCircle(i))
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
      var newRadius = getOuterRadius(d.time);
      var radiusInterpolate = d3.interpolate(oldRadius, newRadius);
      this._oldRadius = newRadius;
      return function(t) {
        return arcGenerator
          .innerRadius(innerR)
          .outerRadius(radiusInterpolate(t))
          .startAngle(i * angleStep)
          .endAngle((i + 1) * angleStep)();
      };
    });

  // Update legend for Circle Chart
  const legend = circleSvg.select(".circle-legend").selectAll("g")
      .data(data);
  const legendEnter = legend.enter().append("g")
      .attr("transform", (d, i) => `translate(0, ${i * 20})`);
      
  legendEnter.append("rect")
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", (d, i) => colorScaleCircle(i));
  
  legendEnter.append("text")
      .attr("x", 20)
      .attr("y", 12)
      .text(d => d.workstation)
      .style("font-size", "12px");
      
  legend.exit().remove();
}

function initBarStatus() {
  const width = 600, height = 300;
  barStatausSvg = d3.select("#average-delay-time")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  barStatusG = barStatausSvg.append("g")
    .attr("transform", `translate(${40}, ${20})`);
}

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
  
  barStatusG.selectAll(".x.axis").remove();
  barStatusG.selectAll(".y.axis").remove();
  barStatusG.append("g")
      .attr("class", "x axis")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(x).tickSize(0));
  barStatusG.append("g")
      .attr("class", "y axis")
      .call(d3.axisLeft(y).ticks(6));

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

const extraCharts = {
  accidentRate: {},
  workstationStatus: {},
  bottleneckTimes: {},
  supplierMetrics: {}
};

function initExtraCharts() {
  initAccidentRateChart();
  initWorkstationStatusChart();
  initBottleneckTimesChart();
  initSupplierMetricsChart();
}

function updateExtraCharts(filteredData) {
  const accidentRates = filteredData.map(d => d.accident_rate);
  const lastStatus = filteredData[filteredData.length - 1].workstation_status;
  const waitingTimes = filteredData.map(d => d.bottleneck_workstations.waiting_times);
  const supplierOccupancy = filteredData.map(d => d.supplier_occupancy);
  const avgFixTimes = filteredData.map(d => d.avg_fix_time);

  updateAccidentRateChart(accidentRates);
  updateWorkstationStatusChart(lastStatus);
  updateBottleneckTimesChart(waitingTimes);
  updateSupplierMetricsChart(supplierOccupancy, avgFixTimes);
}

function initAccidentRateChart() {
  const margin = { top: 20, right: 20, bottom: 30, left: 50 };
  const width = 650 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;
  const svg = d3.select('#accident-rate')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

  extraCharts.accidentRate = { svg, margin, width, height };
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

  svg.select('.x-axis')
      .transition().duration(1000)
      .call(d3.axisBottom(x).tickSize(0));
  svg.select('.y-axis')
      .transition().duration(1000)
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + '%'));

  const bars = svg.selectAll('rect.bar')
      .data(data, (_, i) => i);

  bars.exit()
      .transition().duration(1000)
      .attr('y', y(0))
      .attr('height', 0)
      .remove();

  const barsEnter = bars.enter().append('rect')
      .attr('class', 'bar')
      .attr('x', (_, i) => x(i + 1))
      .attr('width', x.bandwidth())
      .attr('y', y(0))
      .attr('height', 0)
      .attr('fill', '#69b3a2');

  barsEnter.merge(bars)
      .transition().duration(1000)
      .attr('x', (_, i) => x(i + 1))
      .attr('width', x.bandwidth())
      .attr('y', d => y(d))
      .attr('height', d => height - y(d));
}

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

  svg.select('.x-axis').transition().duration(1000).call(d3.axisBottom(x));
  svg.select('.y-axis').transition().duration(1000).call(d3.axisLeft(y));

  const color = d3.scaleOrdinal().domain(keys).range(d3.schemeCategory10);

  const groups = svg.selectAll('g.layer')
    .data(series, d => d.key);
  groups.exit().remove();
  const groupsEnter = groups.enter().append('g')
      .attr('class', 'layer')
      .attr('fill', d => color(d.key));
  const layer = groupsEnter.merge(groups);

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

  // Add legend group for Bottleneck Times Chart
  svg.append("g")
    .attr("class", "bottleneck-legend")
    .attr("transform", `translate(${width + 20}, 20)`);
}

function updateBottleneckTimesChart(waitingData) {
  const { svg, width, height } = extraCharts.bottleneckTimes;
  const iterations = waitingData.length;
  const stationCount = waitingData[0]?.length || 0;

  const x = d3.scaleLinear().domain([1, iterations]).range([0, width]);
  const y = d3.scaleLog()
      .domain([1, d3.max(waitingData.flat())])
      .range([height, 0]);

  svg.select('.x-axis')
      .transition().duration(1000)
      .call(d3.axisBottom(x).ticks(iterations).tickFormat(d3.format('d')));
  svg.select('.y-axis')
      .transition().duration(1000)
      .call(d3.axisLeft(y).ticks(5, '.1s'));

  const stations = d3.range(stationCount).map(i => ({
    id: i,
    values: waitingData.map((d, j) => ({ x: j + 1, y: d[i] }))
  }));

  const color = d3.scaleOrdinal().domain(stations.map(s => s.id)).range(d3.schemeCategory10);
  const lineGen = d3.line().x(d => x(d.x)).y(d => y(d.y));

  const lines = svg.selectAll('path.line').data(stations, d => d.id);
  lines.exit().remove();
  const linesEnter = lines.enter().append('path')
      .attr('class', 'line')
      .attr('fill', 'none');
  linesEnter.merge(lines)
      .transition().duration(1000)
      .attr('stroke', d => color(d.id))
      .attr('d', d => lineGen(d.values));

  // Update legend for Bottleneck Waiting Times Chart
  const legend = svg.select(".bottleneck-legend").selectAll("g")
      .data(stations);
  const legendEnter = legend.enter().append("g")
      .attr("transform", (d, i) => `translate(0, ${i * 20})`);
  
  legendEnter.append("rect")
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", d => color(d.id));
  
  legendEnter.append("text")
      .attr("x", 20)
      .attr("y", 12)
      .text(d => "Station " + (d.id + 1))
      .style("font-size", "12px");
      
  legend.exit().remove();
}

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

  const halfWidth = (width - 40) / 2;
  svg.append('g').attr('class','occupancy').attr('transform','translate(0,0)');
  svg.append('g').attr('class','fixTime').attr('transform',`translate(${halfWidth+40},0)`);

  extraCharts.supplierMetrics = { svg, margin, width: halfWidth, height, groups: { occupancy: svg.select('.occupancy'), fixTime: svg.select('.fixTime') } };

  extraCharts.supplierMetrics.groups.occupancy.append('g').attr('class','x-axis').attr('transform',`translate(0,${height- margin.bottom})`);
  extraCharts.supplierMetrics.groups.occupancy.append('g').attr('class','y-axis');
  extraCharts.supplierMetrics.groups.fixTime.append('g').attr('class','x-axis').attr('transform',`translate(0,${height- margin.bottom})`);
  extraCharts.supplierMetrics.groups.fixTime.append('g').attr('class','y-axis');
}

function updateSupplierMetricsChart(occupancyData, fixTimeData) {
  const { groups, width, height } = extraCharts.supplierMetrics;
  const occVals = occupancyData.map((v, i) => ({ x: i + 1, y: v * 100 }));
  updateSmallColumn(groups.occupancy, occVals, width, height, 'Supplier Occupancy (%)', "#8884d8");
  
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
