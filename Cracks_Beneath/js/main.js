// Set margins and dimensions for the SVG container.
var margin = {top: 60, right: 160, bottom: 60, left: 100},
    width = 800 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;

// Append SVG object to the div with id "chart".
var svg = d3.select("#chart-area")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// Load the JSON simulation results.
d3.json("data/simulation_results_20250410_093155.json").then(function(simulations) {

    // Process the data: extract accepted products, average delay time and WS0 waiting time.
    var data = simulations.map(function(sim) {
        return {
            acceptedProducts: sim.accepted_products,
            avgDelay: sim.avg_delay_time,
            // Assumes WS0 waiting time is the first value in the waiting_times list
            ws0Waiting: sim.bottleneck_workstations.waiting_times[0]
        };
    });

    // Define the scales based on data extents.
    var xExtent = d3.extent(data, d => d.acceptedProducts);
    var yExtent = d3.extent(data, d => d.avgDelay);
    var colorExtent = d3.extent(data, d => d.ws0Waiting); // For WS0 waiting time

    // X scale: accepted products.
    var xScale = d3.scaleLinear()
        .domain([xExtent[0], xExtent[1]])
        .range([0, width])
        .nice();

    // Y scale: average delay time.
    var yScale = d3.scaleLinear()
        .domain([yExtent[0], yExtent[1]])
        .range([height, 0])
        .nice();

    // Color scale: We want lower waiting time to be cool (blue) and higher to be warm (red).
    // d3.interpolateRdYlBu outputs red (t=0) to blue (t=1) so we reverse the domain.
    var colorScale = d3.scaleSequential(d3.interpolateRdYlBu)
        // Reverse the domain so that the minimum (low waiting time) maps to blue and maximum to red.
        .domain([colorExtent[1], colorExtent[0]]);

    // Add X axis.
    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xScale));

    // Add Y axis.
    svg.append("g")
        .call(d3.axisLeft(yScale));

    // Plot scatter points.
    svg.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(d.acceptedProducts))
        .attr("cy", d => yScale(d.avgDelay))
        .attr("r", 5)
        .attr("fill", d => colorScale(d.ws0Waiting))
        .attr("stroke", "black");

    // Add X axis label.
    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 10)
        .attr("text-anchor", "middle")
        .text("Accepted Products");

    // Add Y axis label.
    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 15)
        .attr("text-anchor", "middle")
        .text("Average Delay Time");

    // Add the title.
    svg.append("text")
        .attr("class", "title")
        .attr("x", (width-margin)/2 )
        .attr("y", -20)
        .text("Graph 3: Average Delay Time vs. Accepted Products (Colored by WS0 Waiting Time)");

    // ========================================================================
    // Legend modificada: vertical y posicionada a la derecha del gráfico.
    // ========================================================================

    // Define a linear gradient for the legend.
    var defs = svg.append("defs");
    var linearGradient = defs.append("linearGradient")
        .attr("id", "linear-gradient")
        // Para un gradiente vertical, se define de abajo (100%) a arriba (0%)
        .attr("x1", "0%")
        .attr("y1", "100%")
        .attr("x2", "0%")
        .attr("y2", "0%");

    // Generate color stops for the gradient.
    var stops = 10;
    for (var i = 0; i <= stops; i++) {
        var t = i / stops;
        // Compute a value between min and max waiting times.
        var value = colorExtent[0] + t * (colorExtent[1] - colorExtent[0]);
        linearGradient.append("stop")
            .attr("offset", (t * 100) + "%")
            .attr("stop-color", colorScale(value));
    }

    // Define dimensions and position for the legend rectangle.
    var legendWidth = 10, legendHeight = 200;
    // Ubicar el legend a la derecha del área del gráfico:
    var legendX = width;
    // Centrar verticalmente la leyenda respecto al gráfico.
    var legendY = (height - legendHeight/2) / 2;

    // Draw the legend rectangle.
    svg.append("rect")
        .attr("x", legendX)
        .attr("y", legendY)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#linear-gradient)");

    // Create a scale for the legend axis.
    var legendScale = d3.scaleLinear()
        .domain([colorExtent[0], colorExtent[1]])
        // Invertir el rango para que el mínimo (abajo) y el máximo (arriba)
        .range([legendHeight, 0]);

    // Add the legend axis (ticks on the right side of the legend).
    var legendAxis = d3.axisRight(legendScale)
        .ticks(5);

    svg.append("g")
        .attr("class", "legend axis")
        .attr("transform", "translate(" + (legendX + legendWidth) + "," + legendY + ")")
        .call(legendAxis);

    // Add legend label above the legend.
    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", legendX + legendWidth / 2)
        .attr("y", legendY - 10)
        .attr("text-anchor", "middle")
        .text("Waiting Time at WS0");

}).catch(function(error){
    console.error("Error loading or processing data: ", error);
});
