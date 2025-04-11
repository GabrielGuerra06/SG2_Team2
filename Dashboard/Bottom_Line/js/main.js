d3.json('data/simulation_results_20250410_093155.json').then(function(simulations) {
    const nWorkstations = 6;
    let frequencies = Array(nWorkstations).fill(0);

    simulations.forEach(sim => {
        const station = sim.bottleneck_workstations.bottleneck_station;
        frequencies[station] += 1;
    });

    const data = frequencies.map((count, i) => ({ label: `WS ${i}`, count: count }));

    const margin = { top: 50, right: 20, bottom: 50, left: 20},
        width  = 800 - margin.left - margin.right,
        height = 600 - margin.top - margin.bottom;

    const svg = d3.select('#chart-area')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left + 80},${margin.top})`);

    const x = d3.scaleBand()
        .domain(data.map(d => d.label))
        .range([0, width - 80])
        .padding(0.1);

    const maxCount = d3.max(data, d => d.count);
    const y = d3.scaleLinear()
        .domain([0, maxCount + 1])
        .range([height, 0]);

    svg.append('g')
        .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(x));

    svg.append('g')
        .call(d3.axisLeft(y));

    const yAxisGrid = d3.axisLeft(y)
        .ticks(5)
        .tickSize(-width)
        .tickFormat('');

    svg.append('g')
        .attr('class', 'grid')
        .call(yAxisGrid);

    svg.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.label))
        .attr('y', d => y(d.count))
        .attr('width', x.bandwidth())
        .attr('height', d => height - y(d.count))
        .attr('fill', 'salmon')
        .attr('stroke', 'black');

    svg.append('text')
        .attr('class', 'x label')
        .attr('text-anchor', 'middle')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom - 10)
        .text('Workstation');

    svg.append('text')
        .attr('class', 'y label')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -margin.left - 20)
        .text('Bottleneck Frequency (Count)');

    svg.append('text')
        .attr('class', 'chart title')
        .attr('x', width / 2)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .text('Graph 5: Bottleneck Workstation Frequency');
})
    .catch(function(error) {
        console.error('Error loading the simulation data:', error);
    });