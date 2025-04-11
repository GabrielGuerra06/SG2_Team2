d3.json("data/simulation_results_20250410_093155.json").then(function (simulations) {
    var n_runs = simulations.length;
    var n_workstations = 6;
    var waiting_sum = Array(n_workstations).fill(0);
    simulations.forEach(function (run) {
        var waiting_times = run["bottleneck_workstations"]["waiting_times"];
        for (var i = 0; i < n_workstations; i++) {
            waiting_sum[i] += waiting_times[i];
        }
    });
    var avg_waiting = waiting_sum.map(function (total) {
        return total / n_runs;
    });
    var ws_labels = d3.range(n_workstations).map(function (i) {
        return "WS " + i;
    });
    var margin = {top: 40, right: 60, bottom: 50, left: 60},
        width = 600 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom;
    var container = d3.select("#chart-area")
        .style("text-align", "center")
    container.insert("h2", ":first-child")
        .text("Average Waiting Time per Workstation");
    var svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    var xScale = d3.scaleBand()
        .domain(ws_labels)
        .range([0, width])
        .padding(0.1);
    var yScale = d3.scaleLinear()
        .domain([0, d3.max(avg_waiting)]).nice()
        .range([height, 0]);
    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xScale));
    svg.append("g")
        .call(d3.axisLeft(yScale));
    svg.selectAll(".bar")
        .data(avg_waiting)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", function (d, i) {
            return xScale(ws_labels[i]);
        })
        .attr("y", function (d) {
            return yScale(d);
        })
        .attr("width", xScale.bandwidth())
        .attr("height", function (d) {
            return height - yScale(d);
        })
        .attr("fill", "skyblue");
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 10)
        .attr("text-anchor", "middle")
        .text("Workstation");
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 15)
        .attr("x", -height / 2)
        .attr("dy", "-1em")
        .attr("text-anchor", "middle")
        .text("Average Waiting Time");
}).catch(function (error) {
    console.error("Error al cargar el archivo JSON:", error);
});
