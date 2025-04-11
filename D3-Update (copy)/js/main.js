d3.json("data/simulation_results_20250410_093155.json").then(function(data) {
    const totalDays = data.length;
    const numWorkstations = data[0].occupancy_per_workstation.length;

    // Sumar ocupación por estación
    const sums = new Array(numWorkstations).fill(0);
    data.forEach(entry => {
        entry.occupancy_per_workstation.forEach((value, i) => {
            sums[i] += value;
        });
    });

    // Calcular promedios por estación
    const occupancyData = sums.map((sum, i) => ({
        workstation: `Work station ${i}`,
        measure: sum / totalDays,
        target: 0.95
    }));

    // Ordenar de menor a mayor
    occupancyData.sort((a, b) => a.measure - b.measure);

    const width = 400;
    const height = 40;
    const margin = { top: 10, right: 50, bottom: 10, left: 120 };

    const charts = d3.select("#chart-area")
        .selectAll("svg")
        .data(occupancyData)
        .enter()
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    charts.each(function(d) {
        const g = d3.select(this);
        const x = d3.scaleLinear().domain([0, 1]).range([0, width]);

        // Fondo degradado por zonas
        g.append("rect") // Bajo (0-60%)
            .attr("x", 0)
            .attr("width", x(0.6))
            .attr("height", height)
            .attr("fill", "#f2f2f2");

        g.append("rect") // Medio (60-90%)
            .attr("x", x(0.6))
            .attr("width", x(0.9) - x(0.6))
            .attr("height", height)
            .attr("fill", "#d9d9d9");

        g.append("rect") // Bueno (90-100%)
            .attr("x", x(0.9))
            .attr("width", x(1) - x(0.9))
            .attr("height", height)
            .attr("fill", "#bdbdbd");

        // Barra de medida
        g.append("rect")
            .attr("x", 0)
            .attr("width", x(d.measure))
            .attr("height", height / 2)
            .attr("y", height / 4)
            .attr("fill", d.measure >= d.target ? "steelblue" : "#e67e22")
            .append("title")
            .text(`Workstation: ${d.workstation}\nAvg: ${(d.measure * 100).toFixed(2)}%\nTarget: ${(d.target * 100)}%`);

        // Línea roja del objetivo
        g.append("line")
            .attr("x1", x(d.target))
            .attr("x2", x(d.target))
            .attr("y1", 0)
            .attr("y2", height)
            .attr("stroke", "black")
            .attr("stroke-width", 2);

        // Texto de nombre
        g.append("text")
            .attr("x", -10)
            .attr("y", height / 2)
            .attr("dy", ".35em")
            .attr("text-anchor", "end")
            .text(d.workstation);

        // Texto del valor
        g.append("text")
            .attr("x", x(d.measure) + 5)
            .attr("y", height / 2)
            .attr("dy", ".35em")
            .text((d.measure * 100).toFixed(1) + "%")
            .attr("fill", "#333");
    });
});
