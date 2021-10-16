import React, {Component} from 'react';
import "./visualizer.css"

export default class Visualizer extends Component {
    constructor(props) {
        super(props);
        this.state = {
            grid: [],
            mouseIsPressed: false
        };
    }

    resize = () => this.forceUpdate()

    componentWillUnmount() {
        window.removeEventListener('resize', this.resize)
    }

    componentDidMount() {
        this.createGrid();
        window.addEventListener('resize', this.resize)
    }

    componentDidUpdate() {
        this.createGrid();
    }

    resolution = 32

    createGrid() {
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d')

        canvas.width = 1025;
        canvas.height = 513;

        for (let y = 0; y < canvas.height; y+= this.resolution) {
            for (let x = 0; x < canvas.width; x+= this.resolution) {
                this.drawLine(ctx,x,y, x, y+this.resolution)
                this.drawLine(ctx,x,y, x+this.resolution, y)
            }
        }
    }

    drawLine(ctx, x,y, xd, yd) {
        ctx.beginPath();
        ctx.moveTo(x,y)
        ctx.lineTo(xd, yd)
        ctx.stroke();
    }

    render() {
        // const {grid} = this.props;

        return (
            <>
                <canvas id={"canvas"}/>

            </>
        )
    }
}