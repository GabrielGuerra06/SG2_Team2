

var margin = { top: 50, right: 120, bottom: 60, left: 70 },
    width = 800 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

var svg = d3.select("#chart-area")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

d3.json("data/simulation_results_20250410_093155.json").then(function(simulations) {

    var data = simulations.map(function(sim) {
        return {
            avgDelay: sim.avg_delay_time,
            faultyRate: sim.faulty_product_rate * 100,
            ws0waiting: sim.bottleneck_workstations.waiting_times[0]
        };
    });

    var xScale = d3.scaleLinear()
        .domain([
            d3.min(data, function(d) { return d.avgDelay; }) * 0.95,
            d3.max(data, function(d) { return d.avgDelay; }) * 1.05
        ])
        .range([0, width]);

    var yScale = d3.scaleLinear()
        .domain([
            d3.min(data, function(d) { return d.faultyRate; }) * 0.95,
            d3.max(data, function(d) { return d.faultyRate; }) * 1.05
        ])
        .range([height, 0]);

    var colorScale = d3.scaleSequential(d3.interpolateViridis)
        .domain(d3.extent(data, function(d) { return d.ws0waiting; }));

    var xAxis = d3.axisBottom(xScale).ticks(10);
    var yAxis = d3.axisLeft(yScale).ticks(10);

    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis)
        .append("text")
        .attr("class", "x label")
        .attr("x", width / 2)
        .attr("y", 40)
        .attr("fill", "black")
        .attr("text-anchor", "middle")
        .text("Average Delay Time");

    svg.append("g")
        .call(yAxis)
        .append("text")
        .attr("class", "y label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -50)
        .attr("fill", "black")
        .attr("text-anchor", "middle")
        .text("Faulty Product Rate (%)");

    function make_x_gridlines() {
        return d3.axisBottom(xScale).ticks(10);
    }

    function make_y_gridlines() {
        return d3.axisLeft(yScale).ticks(10);
    }

    svg.append("g")
        .attr("class", "grid")
        .attr("transform", "translate(0," + height + ")")
        .call(make_x_gridlines()
            .tickSize(-height)
            .tickFormat("")
        );

    svg.append("g")
        .attr("class", "grid")
        .call(make_y_gridlines()
            .tickSize(-width)
            .tickFormat("")
        );

    svg.selectAll("circle")
        .data(data)
        .enter().append("circle")
        .attr("cx", function(d) { return xScale(d.avgDelay); })
        .attr("cy", function(d) { return yScale(d.faultyRate); })
        .attr("r", 8)
        .attr("stroke", "black")
        .attr("fill", function(d) { return colorScale(d.ws0waiting); });

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text("Graph 4: Faulty Product Rate vs. Delay Time\n(Colored by Waiting Time at WS0)");

    var legendWidth = 20,
        legendHeight = 500;

    var legendSvg = svg.append("g")
        .attr("class", "legend")
        .attr("transform", "translate(" + (width + 40) + ",0)");

    var defs = legendSvg.append("defs");

    var linearGradient = defs.append("linearGradient")
        .attr("id", "linear-gradient")
        .attr("x1", "0%")
        .attr("y1", "100%")
        .attr("x2", "0%")
        .attr("y2", "0%");

    var legendDomain = colorScale.domain();
    var stops = d3.range(0, 1.01, 0.01);
    stops.forEach(function(t) {
        linearGradient.append("stop")
            .attr("offset", (t * 100) + "%")
            .attr("stop-color", colorScale(legendDomain[0] + t * (legendDomain[1] - legendDomain[0])));
    });

    legendSvg.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#linear-gradient)");

    var legendScale = d3.scaleLinear()
        .domain(legendDomain)
        .range([legendHeight, 0]);

    var legendAxis = d3.axisRight(legendScale)
        .ticks(6);

    legendSvg.append("g")
        .attr("transform", "translate(" + legendWidth + ",0)")
        .call(legendAxis)
        .append("text")
        .attr("y", -10)
        .attr("x", -legendWidth / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "black")
        .text("Waiting Time at WS0");

}).catch(function(error) {
    console.error("Error al cargar los datos:", error);
});
