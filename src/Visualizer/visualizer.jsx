import React, {Component} from 'react';
import "./visualizer.css"
import {dijkstra, getNodesInShortestPathOrder} from '../algorithms/dijkstra'
import 'rc-slider/assets/index.css';
import Rainbow from 'rainbowvis.js'

const resolution = 65
const width = 1470;
const height = 700;

const START_NODE_COL = 5;
const START_NODE_ROW = 5;

const FINISH_NODE_COL = 20
const FINISH_NODE_ROW = 5;

let timeouts = [];

let canvas;
let ctx;

const FRAMES_PER_SECOND = 60;  // Valid values are 60,30,20,15,10...
// set the mim time to render the next frame
const FRAME_MIN_TIME = (1000/60) * (60 / FRAMES_PER_SECOND) - (1000/60) * 0.5;
var lastFrameTime = 0;  // the last frame time

let lastMousePos = {x:0,y:0}

let mouseStillPressed = false;

let rects = [];

class roundNode {
    constructor(x, y, width, height, radius, gradient) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.radius = radius;
        this.color = "Black";
        this.time = 0;
        this.gradient = gradient;
    }

    draw(time) {
        this.time += time;

        this.frame = Math.floor(this.time)/847

        // if(this.gradient === undefined) {
        //     this.color = "Yellow";
        // } else {
        //     this.color = "Blue"
        // }

        ctx.clearRect(this.x, this.y, this.width, this.height);

        ctx.fillStyle = "#"+this.gradient.colourAt(this.frame)

        ctx.beginPath();
        ctx.moveTo(this.x + this.radius, this.y);
        ctx.lineTo(this.x + this.width - this.radius, this.y);
        ctx.quadraticCurveTo(this.x + this.width, this.y, this.x + this.width, this.y + this.radius);
        ctx.lineTo(this.x + this.width, this.y + this.height - this.radius);
        ctx.quadraticCurveTo(this.x + this.width, this.y + this.height, this.x + this.width - this.radius, this.y + this.height);
        ctx.lineTo(this.x + this.radius, this.y + this.height);
        ctx.quadraticCurveTo(this.x, this.y + this.height, this.x, this.y + this.height - this.radius);
        ctx.lineTo(this.x, this.y + this.radius);
        ctx.quadraticCurveTo(this.x, this.y, this.x + this.radius, this.y);
        ctx.closePath();
        ctx.fill()


        if(this.radius >= 0) {
            this.radius -= 0.5417
        } else {
            rects.splice(rects.indexOf(this), 1);
        }
    }
}

export default class Visualizer extends Component {
    constructor(props) {
        super(props);
        this.state = {
            grid: [],
            mouseIsPressed: false,
            width: 22,
            height: 10,
        };
    }

    resize = () => this.forceUpdate()

    componentWillUnmount() {
        window.removeEventListener('resize', this.resize)
    }

    componentDidMount() {
        this.setState({ grid: getInitialGrid() });
        this.createGrid();
        window.addEventListener('resize', this.resize)
    }

    //#region grid

    createGrid() {
        canvas = document.getElementById('canvas');
        ctx = canvas.getContext('2d')

        const {width,height} = this.state

        canvas.width = width*resolution;
        canvas.height = height*resolution;

        for (let y = 0; y < canvas.height; y+= resolution) {
            for (let x = 0; x < canvas.width; x+= resolution) {
                this.createPartGrid(x,y)
                if(x/resolution === START_NODE_COL && y/resolution === START_NODE_ROW) {
                    ctx.fillStyle = 'Green'
                    this.drawCube(x/resolution,y/resolution)
                }
                if(x/resolution === FINISH_NODE_COL && y/resolution === FINISH_NODE_ROW) {
                    ctx.fillStyle = 'Red'
                    this.drawCube(x/resolution,y/resolution)
                }
            }
        }
        this.drawLine(0,canvas.height,canvas.width,canvas.height)
        this.drawLine(canvas.width,0,canvas.width,canvas.height)

        const {grid} = this.state
        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                if(grid[y][x].isWall) {
                    this.drawWall(x,y)
                }
            }
        }
        window.requestAnimationFrame(this.draw.bind(this));
        // let gradient = new Rainbow();
        // gradient.setSpectrum('Yellow', 'Blue')
        // gradient.setNumberRange(0,1)
        // rects.push(new roundNode(1, 1, 63, 63, 32.5, gradient))
    }

    draw(time) {
        const deltaTime = time - lastFrameTime
        if(deltaTime < FRAME_MIN_TIME) {
            window.requestAnimationFrame(this.draw.bind(this));
            return;
        }
        lastFrameTime = time;
        for (const rect of rects) {
            rect.draw(deltaTime)
        }

        window.requestAnimationFrame(this.draw.bind(this));
    }

    createPartGrid(x,y) {
        ctx.strokeStyle = 'Black'
        this.drawLine(x,y, x, y+resolution)
        this.drawLine(x,y, x+resolution, y)
    }

    //#endregion

    //#region mouse
    getCursorPosition(event) {
        const rect = canvas.getBoundingClientRect()
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        return {x: x, y: y}
    }

    handleMouseDown() {
        this.setState({mouseIsPressed: true});
        mouseStillPressed = true;
    }

    handleMouseMove(e) {
        // console.log(this.getCursorPosition(e).x + " | " + this.getCursorPosition(e).y)
        if (!this.state.mouseIsPressed) return;
        this.calculateWall(e);
        mouseStillPressed = false;
    }

    handleMouseUp(e) {
        this.setState({mouseIsPressed: false});
        if(mouseStillPressed) {
            lastMousePos.x++;
            this.calculateWall(e);
        }
    }

    //#endregion

    //#region dijkstra visual

    animateDijkstra(visitedNodesInOrder, nodesInShortestPathOrder) {
        for (let i = 0; i < visitedNodesInOrder.length; i++) {
            if(i === visitedNodesInOrder.length-1) {
                timeouts.push(setTimeout(() => {
                    this.shortPath(nodesInShortestPathOrder);
                }, 32 * i));
            }
            // eslint-disable-next-line no-loop-func
            timeouts.push(setTimeout(() => {
                const node = visitedNodesInOrder[i];
                ctx.fillStyle = 'Blue'
                let gradient = new Rainbow();
                gradient.setSpectrum('Yellow', 'Blue', 'Aqua')
                gradient.setNumberRange(0,1)
                rects.push(new roundNode(node.col*resolution+1, node.row*resolution+1, 63, 63, 32.5, gradient))
                // this.drawCube(node.col, node.row)
            }, 30*i))
        }
    }

    shortPath(nodesInShortestPathOrder) {
        for (let i = 0; i < nodesInShortestPathOrder.length; i++) {
            // eslint-disable-next-line no-loop-func
            timeouts.push(setTimeout(() => {
                const node = nodesInShortestPathOrder[i];
                let gradient = new Rainbow();
                gradient.setSpectrum('Red', 'Yellow')
                gradient.setNumberRange(0,1)
                rects.push(new roundNode(node.col*resolution+1, node.row*resolution+1, 63, 63, 32.5, gradient))
            }, 50 * i));
        }
    }

    visualizeDijkstra() {
        const {grid} = this.state;
        const startNode = grid[START_NODE_ROW][START_NODE_COL];
        const finishNode = grid[FINISH_NODE_ROW][FINISH_NODE_COL];
        const visitedNodesInOrder = dijkstra(grid, startNode, finishNode);
        const nodesInShortestPathOrder = getNodesInShortestPathOrder(finishNode);
        this.animateDijkstra(visitedNodesInOrder, nodesInShortestPathOrder);
    }

    //#endregion

    drawLine(x,y, xd, yd) {
        ctx.beginPath();
        ctx.moveTo(x,y)
        ctx.lineTo(xd, yd)
        ctx.stroke();
    }

    drawCube(col,row) {
        ctx.beginPath();
        ctx.fillRect(col*resolution+1, row*resolution+1, resolution-2, resolution-2)
        ctx.stroke();
    }

    calculateWall(e) {
        const pos = this.getCursorPosition(e)
        const pos2 = {x: Math.floor(pos.x/resolution), y: Math.floor(pos.y/resolution)}
        if(lastMousePos.x === pos2.x && lastMousePos.y === pos2.y) return;
        lastMousePos = pos2;
        this.drawWall(pos2.x,pos2.y)
    }

    drawWall(x,y) {
        const {grid} = this.state;
        const newGrid = grid.slice();
        const node = newGrid[y][x]
        newGrid[y][x] = {
            ...node,
            isWall: !node.isWall,
        };
        if(newGrid[y][x].isWall) {
            ctx.fillStyle = 'Black'
            this.drawCube(x, y)
        } else {
            ctx.clearRect(x*resolution+1, y*resolution+1, resolution-2,resolution-2)
            // this.createPartGrid(x*resolution,y*resolution);
        }
        this.setState({grid: newGrid})
    }

    fullReset() {
        this.setState({ grid: getInitialGrid() });
        ctx.clearRect(0,0,canvas.width, canvas.height)
        this.createGrid()
        for (let i = 0; i < timeouts.length; i++) {
            clearTimeout(timeouts[i]);
        }
        timeouts = []
    }

    // sliderChanged(id, val) {
    //     if(id===0) {
    //         this.setState({width: val})
    //     } else if(id===1) {
    //         this.setState({height: val})
    //     }
    //     this.reDrawGrid()
    // }


    render() {
        // const {width,height} = this.state;

        return (
            <>
                {/*<div style={{width: 100}}>*/}
                {/*    <div>*/}
                {/*        <Slider min={4} max={100} defaultValue={width} tipFormatter={value => `${value}%`} onChange={(val) => this.sliderChanged(0,val)}/>*/}
                {/*        <label>{width}</label>*/}
                {/*    </div>*/}
                {/*    <div style={{height: 10}}/>*/}
                {/*    <>*/}
                {/*        <Slider min={4} max={100} defaultValue={height} onChange={(val) => this.sliderChanged(1,val)}/>*/}
                {/*        <label>{height}</label>*/}
                {/*    </>*/}
                {/*</div>*/}
                <div>
                    <button onClick={() => this.visualizeDijkstra()}>Visualize</button>
                    <button onClick={() => this.fullReset()}>Reset</button>
                </div>
                <canvas
                    id={"canvas"}
                    // onClick={(e) =>  this.calculateWall(e)}
                    onMouseDown={(e) => this.handleMouseDown(e)}
                    onMouseMove={(e) =>
                        this.handleMouseMove(e)
                    }
                    onMouseUp={(e) => this.handleMouseUp(e)}
                />
            </>
        )
    }
}

const createNode = (col, row) => {
    return {
        col,
        row,
        isStart: row === START_NODE_ROW && col === START_NODE_COL,
        isFinish: row === FINISH_NODE_ROW && col === FINISH_NODE_COL,
        distance: Infinity,
        isVisited: false,
        isWall: false,
        prevNode: null,
    }
}

const getInitialGrid = () => {
    const grid = []
    for (let row = 0; row < height/resolution; row++) {
        const currentRow = []
        for (let col = 0; col < width/resolution; col++) {
            currentRow.push(createNode(col, row));
        }
        grid.push(currentRow);
    }
    return grid;
};