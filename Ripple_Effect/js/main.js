// js/main.js

// Configuración de márgenes y dimensiones del SVG
var margin = { top: 50, right: 120, bottom: 60, left: 70 },
    width = 800 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

// Se agrega el elemento SVG al contenedor con id "chart-area"
var svg = d3.select("#chart-area")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// Carga del archivo JSON (ajusta la ruta si es necesario)
d3.json("data/simulation_results_20250410_093155.json").then(function(simulations) {

    // Se procesan los datos obtenidos
    var data = simulations.map(function(sim) {
        return {
            avgDelay: sim.avg_delay_time,                              // Eje X
            faultyRate: sim.faulty_product_rate * 100,                   // Eje Y (porcentaje)
            ws0waiting: sim.bottleneck_workstations.waiting_times[0]     // Para la escala de color
        };
    });

    // Escala para el eje X (Tiempo de retraso promedio)
    var xScale = d3.scaleLinear()
        .domain([
            d3.min(data, function(d) { return d.avgDelay; }) * 0.95,
            d3.max(data, function(d) { return d.avgDelay; }) * 1.05
        ])
        .range([0, width]);

    // Escala para el eje Y (Tasa de productos defectuosos en %)
    var yScale = d3.scaleLinear()
        .domain([
            d3.min(data, function(d) { return d.faultyRate; }) * 0.95,
            d3.max(data, function(d) { return d.faultyRate; }) * 1.05
        ])
        .range([height, 0]);

    // Escala de color basada en ws0waiting (usando el interpolador Viridis)
    var colorScale = d3.scaleSequential(d3.interpolateViridis)
        .domain(d3.extent(data, function(d) { return d.ws0waiting; }));

    // Creación de ejes
    var xAxis = d3.axisBottom(xScale).ticks(10);
    var yAxis = d3.axisLeft(yScale).ticks(10);

    // Añadimos el eje X
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

    // Añadimos el eje Y
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

    // Opcional: Agregar líneas de cuadrícula para mejorar la lectura del gráfico
    function make_x_gridlines() {
        return d3.axisBottom(xScale).ticks(10);
    }

    function make_y_gridlines() {
        return d3.axisLeft(yScale).ticks(10);
    }

    // Líneas de cuadrícula verticales
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", "translate(0," + height + ")")
        .call(make_x_gridlines()
            .tickSize(-height)
            .tickFormat("")
        );

    // Líneas de cuadrícula horizontales
    svg.append("g")
        .attr("class", "grid")
        .call(make_y_gridlines()
            .tickSize(-width)
            .tickFormat("")
        );

    // Creación de los puntos del scatter plot
    svg.selectAll("circle")
        .data(data)
        .enter().append("circle")
        .attr("cx", function(d) { return xScale(d.avgDelay); })
        .attr("cy", function(d) { return yScale(d.faultyRate); })
        .attr("r", 8)  // Se usa un radio fijo (ajustable según tus necesidades)
        .attr("stroke", "black")
        .attr("fill", function(d) { return colorScale(d.ws0waiting); });

    // Añadir título al gráfico
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text("Graph 4: Faulty Product Rate vs. Delay Time\n(Colored by Waiting Time at WS0)");

    // Creación de la leyenda de color
    var legendWidth = 20,
        legendHeight = 500;

    // Grupo para la leyenda
    var legendSvg = svg.append("g")
        .attr("class", "legend")
        .attr("transform", "translate(" + (width + 40) + ",0)");

    // Definición del gradiente para la leyenda
    var defs = legendSvg.append("defs");

    var linearGradient = defs.append("linearGradient")
        .attr("id", "linear-gradient")
        .attr("x1", "0%")
        .attr("y1", "100%")
        .attr("x2", "0%")
        .attr("y2", "0%");

    // Se definen los "stops" del gradiente en pequeños intervalos
    var legendDomain = colorScale.domain();
    var stops = d3.range(0, 1.01, 0.01);
    stops.forEach(function(t) {
        linearGradient.append("stop")
            .attr("offset", (t * 100) + "%")
            .attr("stop-color", colorScale(legendDomain[0] + t * (legendDomain[1] - legendDomain[0])));
    });

    // Dibujamos el rectángulo que usa el gradiente
    legendSvg.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#linear-gradient)");

    // Escala para el eje de la leyenda
    var legendScale = d3.scaleLinear()
        .domain(legendDomain)
        .range([legendHeight, 0]);

    // Eje de la leyenda
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
