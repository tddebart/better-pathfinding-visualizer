import React, {Component} from 'react';
import "./visualizer.css"

// Pathfinding
import {dijkstra, getNodesInShortestPathOrder} from '../algorithms/dijkstra'
import {greedyBFS, getNodesInShortestPathOrderGreedyBFS} from '../algorithms/greedyBestFirstSearch'
import {astar, getNodesInShortestPathOrderAstar} from '../algorithms/aStar'

// Maze
import {recursiveDivisionMaze} from '../mazeAlgorithms/recursive'
import {randomMaze} from '../mazeAlgorithms/randomMaze'

// Visual and useful
import 'rc-slider/assets/index.css';
import Rainbow from 'rainbowvis.js'
import {
    ButtonGroup,
    Button,
    Select,
    MenuItem,
    InputLabel,
    FormControl,
    AppBar,
    Toolbar,
    Typography, Container
} from "@mui/material";
import gitLogo from "../GitHub-Mark-64px.png";

const resolution = 29
let width = getWidth()
let height =  getHeight()

let START_NODE_COL = 5;
let START_NODE_ROW = 5;

let FINISH_NODE_COL = 20
let FINISH_NODE_ROW = 5;

// the setTimeouts that are currently waiting
let timeouts = [];

let canvas;
let ctx;

let speed = 5;

const FRAMES_PER_SECOND = 60;  // Valid values are 60,30,20,15,10...
// set the mim time to render the next frame
const FRAME_MIN_TIME = (1000/60) * (60 / FRAMES_PER_SECOND) - (1000/60) * 0.5;
let lastFrameTime = 0;  // the last frame time

let lastMousePos = {x:0,y:0}

let mouseStillPressed = false;

let rects = [];

function getWidth() {
    let howManyCells = 0
    let less = 0
    while(howManyCells % 2 === 0) {
        howManyCells = Math.floor(window.innerWidth/resolution)-less;
        less++
    }
    return howManyCells*resolution;
}

function getHeight() {
    let howManyCells = 0
    let less = 0
    while(howManyCells % 2 === 0) {
        howManyCells = Math.floor(window.innerHeight*0.95/resolution)-less;
        less++
    }
    return howManyCells*resolution;
}

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


        if(this.radius > 0) {
            this.radius -= 0.56
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
            isDraggingStart: false,
            isDraggingFinish: false,
        };
    }

    resize = () => {
        width = getWidth();
        height = getHeight();
        this.forceUpdate()
        this.fullReset()
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.resize)
    }

    componentDidMount() {
        this.setState({grid: getInitialGrid()});
        this.createGrid();
        window.addEventListener('resize', this.resize)
        this.algorithm = 0;
        this.maze = 0;
    }

    //#region grid

    createGrid() {
        canvas = document.getElementById('canvas');
        ctx = canvas.getContext('2d')

        canvas.width = width
        canvas.height = height

        for (let y = 0; y < canvas.height; y += resolution) {
            for (let x = 0; x < canvas.width; x += resolution) {
                this.createPartGrid(x, y)
                if (x / resolution === START_NODE_COL && y / resolution === START_NODE_ROW) {
                    ctx.fillStyle = 'Green'
                    this.drawCube(x / resolution, y / resolution)
                }
                if (x / resolution === FINISH_NODE_COL && y / resolution === FINISH_NODE_ROW) {
                    ctx.fillStyle = 'Red'
                    this.drawCube(x / resolution, y / resolution)
                }
            }
        }
        this.drawLine(0, canvas.height, canvas.width, canvas.height)
        this.drawLine(canvas.width, 0, canvas.width, canvas.height)

        window.requestAnimationFrame(this.draw.bind(this));
    }

    draw(time) {
        const deltaTime = time - lastFrameTime
        if (deltaTime < FRAME_MIN_TIME) {
            window.requestAnimationFrame(this.draw.bind(this));
            return;
        }
        lastFrameTime = time;
        for (const rect of rects) {
            rect.draw(deltaTime)
        }

        window.requestAnimationFrame(this.draw.bind(this));
    }

    createPartGrid(x, y) {
        ctx.strokeStyle = 'Black'
        this.drawLine(x, y, x, y + resolution)
        this.drawLine(x, y, x + resolution, y)
    }

    //#endregion

    //#region mouse
    getCursorPositionInPixels(event) {
        const rect = canvas.getBoundingClientRect()
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        return {x: x, y: y}
    }

    getCursorPositionInGrid(event) {
        const pos = this.getCursorPositionInPixels(event)
        return {x: Math.floor(pos.x / resolution), y: Math.floor(pos.y / resolution)}
    }

    handleMouseDown(e) {
        if (this.busy) return;

        const cursPos = this.getCursorPositionInGrid(e)
        const {grid} = this.state;
        if (grid[cursPos.y][cursPos.x].isStart) {
            this.setState({isDraggingStart: true})
        } else if (grid[cursPos.y][cursPos.x].isFinish) {
            this.setState({isDraggingFinish: true})
        }

        this.setState({mouseIsPressed: true});
        mouseStillPressed = true;
    }

    handleMouseMove(e) {
        if (this.busy) return;

        // console.log(this.getCursorPosition(e).x + " | " + this.getCursorPosition(e).y)
        const pos = this.getCursorPositionInGrid(e);
        if (!this.state.mouseIsPressed) return;
        if (this.state.isDraggingStart) {
            this.moveStartOrFinish(pos.x, pos.y, true)
        } else if (this.state.isDraggingFinish) {
            this.moveStartOrFinish(pos.x, pos.y, false)
        } else {
            this.calculateWall(e);
        }
        mouseStillPressed = false;
    }

    handleMouseUp(e) {
        if (this.busy) return;

        this.setState({mouseIsPressed: false, isDraggingStart: false, isDraggingFinish: false});
        if (mouseStillPressed && !this.state.isDraggingStart && !this.state.isDraggingFinish) {
            lastMousePos.x++;
            this.calculateWall(e);
        }
    }

    //#endregion

    //#region dijkstra visual

    animateAlgorithm(visitedNodesInOrder, nodesInShortestPathOrder, instant = false) {
        this.clearVisualization(true);
        for (let i = 0; i < visitedNodesInOrder.length; i++) {
            if (i === 0) continue;
            // eslint-disable-next-line no-loop-func
            timeouts.push(setTimeout(() => {
                if (i === visitedNodesInOrder.length - 1) {
                    this.shortPath(nodesInShortestPathOrder, instant);
                } else {
                    const node = visitedNodesInOrder[i];
                    if (speed === "0" || instant) {
                        ctx.fillStyle = 'Aqua'
                        this.drawCube(node.col, node.row)
                    } else {
                        let gradient = new Rainbow();
                        gradient.setSpectrum('Yellow', 'Blue', 'Aqua')
                        gradient.setNumberRange(0, 0.6)
                        rects.push(new roundNode(node.col * resolution + 1, node.row * resolution + 1, resolution - 2, resolution - 2, resolution / 1.5, gradient))
                    }
                }
            }, speed * i))
        }
        timeouts.push(setTimeout(() => {
            timeouts.push(setTimeout(() => {
                this.busy = false;
            }, speed!=="0" || instant ? 35*nodesInShortestPathOrder.length : 0))
        },speed!=="0" || instant ? speed*(visitedNodesInOrder.length+1): 0))
    }

    shortPath(nodesInShortestPathOrder, instant = false) {
        for (let i = 0; i < nodesInShortestPathOrder.length; i++) {
            if(i===0 || i===nodesInShortestPathOrder.length-1) continue;
            // eslint-disable-next-line no-loop-func
            timeouts.push(setTimeout(() => {
                const node = nodesInShortestPathOrder[i];
                if (speed === "0" || instant) {
                    ctx.fillStyle = 'Yellow'
                    this.drawCube(node.col, node.row)
                } else {
                    let gradient = new Rainbow();
                    gradient.setSpectrum('Red', 'Yellow')
                    gradient.setNumberRange(0, 0.5)
                    rects.push(new roundNode(node.col * resolution + 1, node.row * resolution + 1, resolution - 2, resolution - 2, resolution / 1.5, gradient))
                }
            }, speed!=="0" || instant ? 35 * i : 0));
            timeouts.push(setTimeout(() => {
                this.busy = false;
            }, speed!=="0" || instant ? 35*nodesInShortestPathOrder.length : 0))
        }
    }

    visualize(instant = false) {
        if(this.busy) return;
        this.busy = true;
        const {grid} = this.state;
        const startNode = grid[START_NODE_ROW][START_NODE_COL];
        const finishNode = grid[FINISH_NODE_ROW][FINISH_NODE_COL];
        let visitedNodesInOrder;
        let nodesInShortestPathOrder;

        if(this.algorithm === 0) {
            visitedNodesInOrder = dijkstra(grid, startNode, finishNode);
            nodesInShortestPathOrder = getNodesInShortestPathOrder(finishNode);
        } else if(this.algorithm === 1) {
            visitedNodesInOrder = greedyBFS(grid, startNode, finishNode);
            nodesInShortestPathOrder = getNodesInShortestPathOrderGreedyBFS(finishNode);
        } else if(this.algorithm === 2) {
            visitedNodesInOrder = astar(grid, startNode, finishNode);
            nodesInShortestPathOrder = getNodesInShortestPathOrderAstar(finishNode);
        } else if(this.algorithm === 3) {

        }

        this.animateAlgorithm(visitedNodesInOrder, nodesInShortestPathOrder, instant);
    }

    //#endregion

    //#region moving start & finish

    moveStartOrFinish(x,y,start) {
        let col
        let row
        if(start) {
            col = START_NODE_COL;
            row = START_NODE_ROW;
        } else {
            col = FINISH_NODE_COL;
            row = FINISH_NODE_ROW
        }
        if(lastMousePos.x === x && lastMousePos.y === y) return;
        lastMousePos = {x:x,y:y};
        ctx.clearRect(col*resolution+1, row*resolution+1, resolution-2, resolution-2)
        this.drawStartOrFinish(x,y, start)
        if(this.state.grid[row][col].isWall) {
            const newGrid = this.state.grid.slice()
            newGrid[row][col].isWall = false;
            this.setState({grid: newGrid})
            this.drawWall(col,row)
        }
        if(start) {
            START_NODE_COL = x;
            START_NODE_ROW = y;
        } else {
            FINISH_NODE_COL = x;
            FINISH_NODE_ROW = y;
        }
    }

    drawStartOrFinish(x,y, start) {
        const {grid} = this.state;
        const newGrid = grid.slice();
        const node = newGrid[y][x]

        if(start) {
            newGrid[START_NODE_ROW][START_NODE_COL] = {
                ...newGrid[START_NODE_ROW][START_NODE_COL],
                isStart: false
            }
            newGrid[y][x] = {
                ...node,
                isStart: true,
            };
            ctx.fillStyle = 'Green'
        } else {
            newGrid[FINISH_NODE_ROW][FINISH_NODE_COL] = {
                ...newGrid[FINISH_NODE_ROW][FINISH_NODE_COL],
                isFinish: false
            }
            newGrid[y][x] = {
                ...node,
                isFinish: true,
            };
            ctx.fillStyle = 'Red'
        }
        this.drawCube(x, y)
        this.setState({grid: newGrid})
    }

    //#endregion

    visualizeMaze() {
        if(this.busy) return;
        this.resetWalls()
        this.clearVisualization()
        this.busy = true;
        const {grid} = this.state;
        const startNode = grid[START_NODE_ROW][START_NODE_COL];
        const finishNode = grid[FINISH_NODE_ROW][FINISH_NODE_COL];
        let maze;
        if(this.maze === 0) {
            maze = recursiveDivisionMaze(grid, startNode,finishNode)
        } else if (this.maze === 1) {
            maze = randomMaze(grid,startNode,finishNode)
        }
        if(speed === "0") {
            for (const mazeElement of maze) {
                this.drawWall(mazeElement[0], mazeElement[1])
            }
            this.redrawStartAndFinish()
        } else {
            for (let i = 0; i < maze.length; i++) {
                const mazeElement = maze[i]
                timeouts.push(setTimeout(() => this.drawWall(mazeElement[0], mazeElement[1]), speed*i))

            }
            timeouts.push(setTimeout(() => {this.redrawStartAndFinish(); this.busy = false;}, speed*(maze.length+2)))
        }
    }

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
        const pos = this.getCursorPositionInGrid(e)
        if(this.state.grid[pos.y][pos.x].isStart || this.state.grid[pos.y][pos.x].isFinish) {
            return;
        }

        if(lastMousePos.x === pos.x && lastMousePos.y === pos.y) return;
        lastMousePos = pos;
        this.drawWall(pos.x,pos.y)
    }

    drawWall(x,y) {
        const {grid} = this.state;
        const newGrid = grid.slice();
        let widthIn = Math.round(width/resolution)-1
        let heightIn = Math.round(height/resolution)-1
        if(x > widthIn || x < 0 || y > heightIn || y < 0) {
            return;
        }
        const node = newGrid[y][x]
        newGrid[y][x] = {
            ...node,
            isWall: !node.isWall,
        };
        if(newGrid[y][x].isWall) {
            // ctx.fillStyle = 'Black'
            // this.drawCube(x, y)
            if(speed !== "0") {
                let gradient = new Rainbow();
                gradient.setSpectrum('White', 'Black')
                gradient.setNumberRange(0,0.5)
                rects.push(new roundNode(node.col*resolution+1, node.row*resolution+1, resolution-2, resolution-2, resolution/1.5, gradient))
            } else {
                ctx.fillStyle = 'Black'
                this.drawCube(x, y)
            }
        } else {
            ctx.clearRect(x*resolution+1, y*resolution+1, resolution-2,resolution-2)
        }
        this.setState({grid: newGrid})
    }

    //#region reset

    clearVisualization(skipBusyCheck = false) {
        if(!skipBusyCheck && this.busy) return;
        rects = [];
        const {grid} = this.state;
        const newGrid = grid.slice()
        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                if(!grid[y][x].isWall && !grid[y][x].isStart && !grid[y][x].isFinish) {
                    ctx.clearRect(x*resolution+1, y*resolution+1, resolution-2, resolution-2)
                }
                newGrid[y][x].isVisited = false;
                newGrid[y][x].distance = Infinity;
            }
        }
        this.setState({grid: newGrid})
    }

    redrawStartAndFinish() {
        ctx.fillStyle = 'Green'
        this.drawCube(START_NODE_COL,START_NODE_ROW)
        ctx.fillStyle = 'Red'
        this.drawCube(FINISH_NODE_COL,FINISH_NODE_ROW)
        const newGrid = this.state.grid.slice()
        newGrid[START_NODE_ROW][START_NODE_COL].isWall = false;
        newGrid[FINISH_NODE_ROW][FINISH_NODE_COL].isWall = false;
        this.setState({grid: newGrid})
    }

    resetWalls(skipBusyCheck = false) {
        if(!skipBusyCheck && this.busy) return;
        rects = [];
        const {grid} = this.state;
        const newGrid = grid.slice();
        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                if(grid[y][x].isWall) {
                    newGrid[y][x].isWall = false;
                    ctx.clearRect(x*resolution+1, y*resolution+1, resolution-2, resolution-2)
                }
            }
        }
    }

    fullReset() {
        START_NODE_COL = 5;
        START_NODE_ROW = 5;

        FINISH_NODE_COL = 20
        FINISH_NODE_ROW = 5;

        this.busy = false;

        rects = []
        this.setState({ grid: getInitialGrid() });
        ctx.clearRect(0,0,canvas.width, canvas.height)
        this.createGrid()
        for (let i = 0; i < timeouts.length; i++) {
            clearTimeout(timeouts[i]);
        }
        timeouts = []
    }

    //#endregion


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
                <AppBar>
                    <Toolbar>
                        <a href="https://github.com/tddebart/better-pathfinding-visualizer" target="_blank" rel="noreferrer">
                            <img className={"github"} src={gitLogo} alt={"github"} />
                        </a>
                        <Typography variant="h6" component="div" style={{marginLeft: 10}}>
                            Pathfinding visualizer
                        </Typography>
                        <div className={"center"}>
                            {/*Speed control*/}
                            <FormControl variant={'standard'} sx={{ m: 1, minWidth: 80 }}>
                                <InputLabel id="demo-simple-select-label">Speeds</InputLabel>
                                <Select id={"speed"} defaultValue={"5"} style={{textAlign: 'center'}} onChange={(event) => {
                                    speed = event.target.value;
                                }}>
                                    <MenuItem value="80">Slow</MenuItem>
                                    <MenuItem value="30">Fast</MenuItem>
                                    <MenuItem value="15">Faster</MenuItem>
                                    <MenuItem value="5">Extra Fast</MenuItem>
                                    <MenuItem value="0">Instant</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl className={"customSelect"} variant={'standard'} sx={{ m: 1, minWidth: 80 }}>
                                <InputLabel id="demo-simple-select-label">Algorithms</InputLabel>
                                <Select
                                    labelId="demo-simple-select-label"
                                    id="demo-simple-select"
                                    label="Algorithms"
                                    defaultValue={0}
                                    onChange={(event) => {
                                        this.algorithm = event.target.value;
                                    }}
                                >
                                    <MenuItem value={0}>Dijkstra algorithm</MenuItem>
                                    <MenuItem value={1}>A* algorithm</MenuItem>
                                    <MenuItem value={2}>Greedy best first search</MenuItem>
                                </Select>
                            </FormControl>
                            <ButtonGroup variant="contained" className="buttonDown">
                                <Button onClick={() => this.visualize()}>Visualize</Button>
                                <Button onClick={() => this.fullReset()}>Reset</Button>
                                <Button onClick={() => this.resetWalls()}>Clear walls</Button>
                                <Button onClick={() => this.clearVisualization()}>Clear path</Button>
                            </ButtonGroup>

                            <FormControl className={"customSelect"} variant={'standard'} sx={{ m: 1, minWidth: 80 }}>
                                <InputLabel id="demo-simple-select-label">Maze's</InputLabel>
                                <Select
                                    labelId="demo-simple-select-label"
                                    id="demo-simple-select"
                                    label="Maze's"
                                    defaultValue={0}
                                    onChange={(event) => {
                                        this.maze = event.target.value;
                                    }}
                                >
                                    <MenuItem value={0}>Recursive division</MenuItem>
                                    <MenuItem value={1}>Random</MenuItem>
                                </Select>
                            </FormControl>
                            <ButtonGroup variant={"contained"} className="buttonDown">
                               <Button onClick={() => this.visualizeMaze()}>Generate maze</Button>
                            </ButtonGroup>
                        </div>
                    </Toolbar>
                </AppBar>
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