var margin = {top: 60, right: 160, bottom: 60, left: 100},
    width = 800 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;

var svg = d3.select("#chart-area")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

d3.json("data/simulation_results_20250410_093155.json").then(function(simulations) {

    var data = simulations.map(function(sim) {
        return {
            acceptedProducts: sim.accepted_products,
            avgDelay: sim.avg_delay_time,
            ws0Waiting: sim.bottleneck_workstations.waiting_times[0]
        };
    });

    var xExtent = d3.extent(data, d => d.acceptedProducts);
    var yExtent = d3.extent(data, d => d.avgDelay);
    var colorExtent = d3.extent(data, d => d.ws0Waiting);

    var xScale = d3.scaleLinear()
        .domain([xExtent[0], xExtent[1]])
        .range([0, width])
        .nice();

    var yScale = d3.scaleLinear()
        .domain([yExtent[0], yExtent[1]])
        .range([height, 0])
        .nice();

    var colorScale = d3.scaleSequential(d3.interpolateRdYlBu)
        .domain([colorExtent[1], colorExtent[0]]);

    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xScale));

    svg.append("g")
        .call(d3.axisLeft(yScale));

    svg.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(d.acceptedProducts))
        .attr("cy", d => yScale(d.avgDelay))
        .attr("r", 5)
        .attr("fill", d => colorScale(d.ws0Waiting))
        .attr("stroke", "black");

    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 10)
        .attr("text-anchor", "middle")
        .text("Accepted Products");

    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 15)
        .attr("text-anchor", "middle")
        .text("Average Delay Time");

    svg.append("text")
        .attr("class", "title")
        .attr("x", (width-margin)/2 )
        .attr("y", -20)
        .text("Graph 3: Average Delay Time vs. Accepted Products (Colored by WS0 Waiting Time)");


    var defs = svg.append("defs");
    var linearGradient = defs.append("linearGradient")
        .attr("id", "linear-gradient")
        .attr("x1", "0%")
        .attr("y1", "100%")
        .attr("x2", "0%")
        .attr("y2", "0%");

    var stops = 10;
    for (var i = 0; i <= stops; i++) {
        var t = i / stops;
        var value = colorExtent[0] + t * (colorExtent[1] - colorExtent[0]);
        linearGradient.append("stop")
            .attr("offset", (t * 100) + "%")
            .attr("stop-color", colorScale(value));
    }

    var legendWidth = 10, legendHeight = 200;
    var legendX = width;
    var legendY = (height - legendHeight/2) / 2;

    svg.append("rect")
        .attr("x", legendX)
        .attr("y", legendY)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#linear-gradient)");

    var legendScale = d3.scaleLinear()
        .domain([colorExtent[0], colorExtent[1]])
        .range([legendHeight, 0]);

    var legendAxis = d3.axisRight(legendScale)
        .ticks(5);

    svg.append("g")
        .attr("class", "legend axis")
        .attr("transform", "translate(" + (legendX + legendWidth) + "," + legendY + ")")
        .call(legendAxis);

    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", legendX + legendWidth / 2)
        .attr("y", legendY - 10)
        .attr("text-anchor", "middle")
        .text("Waiting Time at WS0");

}).catch(function(error){
    console.error("Error loading or processing data: ", error);
});
