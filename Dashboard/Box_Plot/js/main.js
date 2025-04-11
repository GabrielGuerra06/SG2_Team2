d3.json("data/simulation_results_20250410_093155.json").then(function(data) {
    const rejectionData = data.map(d => d.production_rejection_percentage).sort(d3.ascending);

    const q1 = d3.quantile(rejectionData, 0.25);
    const median = d3.quantile(rejectionData, 0.5);
    const q3 = d3.quantile(rejectionData, 0.75);
    const iqr = q3 - q1;
    const lowerWhisker = q1 - 1.5 * iqr;
    const upperWhisker = q3 + 1.5 * iqr;
    const min = d3.min(rejectionData);
    const max = d3.max(rejectionData);

    const outliers = rejectionData.filter(d => d < lowerWhisker || d > upperWhisker);
    const nonOutliers = rejectionData.filter(d => d >= lowerWhisker && d <= upperWhisker);

    const width = 600;
    const height = 350;
    const margin = { top: 40, right: 30, bottom: 40, left: 30 };

    const svg = d3.select("#chart-area")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const chart = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const x = d3.scaleLinear()
        .domain([Math.floor(min - 1), Math.ceil(max + 1)])
        .range([0, width - margin.left - margin.right]);

    const centerY = (height - margin.top - margin.bottom) / 2;
    const boxWidth = 140;

    chart.append("line")
        .attr("x1", x(Math.max(d3.min(nonOutliers), lowerWhisker)))
        .attr("x2", x(Math.min(d3.max(nonOutliers), upperWhisker)))
        .attr("y1", centerY)
        .attr("y2", centerY)
        .attr("stroke", "black");

    chart.append("rect")
        .attr("x", x(q1))
        .attr("y", centerY - boxWidth / 4)
        .attr("width", x(q3) - x(q1))
        .attr("height", boxWidth / 2)
        .attr("fill", "#69b3a2")
        .attr("stroke", "black");

    chart.append("line")
        .attr("x1", x(median))
        .attr("x2", x(median))
        .attr("y1", centerY - boxWidth / 4)
        .attr("y2", centerY + boxWidth / 4)
        .attr("stroke", "black")
        .attr("stroke-width", 2);

    [Math.max(d3.min(nonOutliers), lowerWhisker), Math.min(d3.max(nonOutliers), upperWhisker)].forEach(val => {
        chart.append("line")
            .attr("x1", x(val))
            .attr("x2", x(val))
            .attr("y1", centerY - boxWidth / 6)
            .attr("y2", centerY + boxWidth / 6)
            .attr("stroke", "black");
    });

    chart.append("g")
        .attr("transform", `translate(0, ${centerY + boxWidth / 2 + 10})`)
        .call(d3.axisBottom(x).tickFormat(d => d.toFixed(1)));

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text("Production Rejection % Distribution");

    const outlierDots = chart.selectAll(".outlier")
        .data(outliers)
        .enter()
        .append("circle")
        .attr("class", "outlier")
        .attr("cx", d => x(d))
        .attr("cy", centerY)
        .attr("r", 0)
        .attr("fill", "#69b3a2")
        .attr("opacity", 0.2)
        .attr("stroke", "black")
        .attr("stroke-width", 0.2)
        .append("title")
        .text(d => `Outlier: ${d.toFixed(2)}%`);

    let showing = false;
    d3.select("#toggle-outliers").on("click", function () {
        showing = !showing;
        d3.select(this).text(showing ? "Hide Outliers" : "Show Outliers");

        chart.selectAll(".outlier")
            .transition()
            .duration(600)
            .attr("r", showing ? 4 : 0)
            .attr("opacity", showing ? 0.8 : 0);
    });
});
