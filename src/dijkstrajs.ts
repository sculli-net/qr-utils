/******************************************************************************
 * Created 2008-08-19.
 *
 * Dijkstra path-finding functions. Adapted from the Dijkstar Python project.
 *
 * Copyright (C) 2008
 *   Wyatt Baldwin <self@wyattbaldwin.com>
 *   All rights reserved
 *
 * Licensed under the MIT license.
 *
 *   http://www.opensource.org/licenses/mit-license.php
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *****************************************************************************/
/**
  * Modified by Matt Scullino 2026 for Typescript and Module support as part of the QR-Util project
*/

type NodeId = string
type Graph = Record<NodeId, Record<NodeId, number>>
type PredecessorMap = Record<NodeId, NodeId>
type CostMap = Record<NodeId, number>

interface PriorityQueueItem {
  value: NodeId
  cost: number
}

type PriorityQueueSorter = (a: PriorityQueueItem, b: PriorityQueueItem) => number

interface PriorityQueueOptions {
  sorter?: PriorityQueueSorter
}

interface PriorityQueueInstance {
  queue: PriorityQueueItem[]
  sorter: PriorityQueueSorter
  push: (value: NodeId, cost: number) => void
  pop: () => PriorityQueueItem | undefined
  empty: () => boolean
}

const dijkstra = {
  single_source_shortest_paths: (graph: Graph, s: NodeId, d?: NodeId): PredecessorMap => {
    // Predecessor map for each node that has been encountered.
    // node ID => predecessor node ID
    const predecessors: PredecessorMap = {}

    // Costs of shortest paths from s to all nodes encountered.
    // node ID => cost
    const costs: CostMap = { [s]: 0 }

    // Costs of shortest paths from s to all nodes encountered; differs from
    // `costs` in that it provides easy access to the node that currently has
    // the known shortest path from s.
    const open = dijkstra.PriorityQueue.make()
    open.push(s, 0)

    while (!open.empty()) {
      // In the nodes remaining in graph that have a known cost from s,
      // find the node, u, that currently has the shortest path from s.
      const closest = open.pop()
      if (!closest) break

      const u = closest.value
      const cost_of_s_to_u = closest.cost

      // Get nodes adjacent to u...
      const adjacent_nodes = graph[u] ?? {}

      // ...and explore the edges that connect u to those nodes, updating
      // the cost of the shortest paths to any or all of those nodes as
      // necessary. v is the node across the current edge from u.
      for (const [v, cost_of_e] of Object.entries(adjacent_nodes)) {
        // Cost of s to u plus the cost of u to v across e--this is *a*
        // cost from s to v that may or may not be less than the current
        // known cost to v.
        const cost_of_s_to_u_plus_cost_of_e = cost_of_s_to_u + cost_of_e

        // If we haven't visited v yet OR if the current known cost from s to
        // v is greater than the new cost we just found (cost of s to u plus
        // cost of u to v across e), update v's cost in the cost list and
        // update v's predecessor in the predecessor list (it's now u).
        const cost_of_s_to_v = costs[v]
        const first_visit = typeof cost_of_s_to_v === 'undefined'
        if (first_visit || cost_of_s_to_v > cost_of_s_to_u_plus_cost_of_e) {
          costs[v] = cost_of_s_to_u_plus_cost_of_e
          open.push(v, cost_of_s_to_u_plus_cost_of_e)
          predecessors[v] = u
        }
      }
    }

    if (typeof d !== 'undefined' && typeof costs[d] === 'undefined') {
      throw new Error(`Could not find a path from ${s} to ${d}.`)
    }

    return predecessors
  },

  extract_shortest_path_from_predecessor_list: (predecessors: PredecessorMap, d: NodeId): NodeId[] => {
    const nodes: NodeId[] = []
    let u: NodeId | undefined = d

    while (u) {
      nodes.push(u)
      u = predecessors[u]
    }

    nodes.reverse()
    return nodes
  },

  find_path: (graph: Graph, s: NodeId, d: NodeId): NodeId[] => {
    const predecessors = dijkstra.single_source_shortest_paths(graph, s, d)
    return dijkstra.extract_shortest_path_from_predecessor_list(predecessors, d)
  },

  /**
   * A very naive priority queue implementation.
   */
  PriorityQueue: {
    make: (opts: PriorityQueueOptions = {}): PriorityQueueInstance => {
      const sorter = opts.sorter ?? dijkstra.PriorityQueue.default_sorter
      return {
        queue: [],
        sorter,
        push: dijkstra.PriorityQueue.push,
        pop: dijkstra.PriorityQueue.pop,
        empty: dijkstra.PriorityQueue.empty
      }
    },

    default_sorter: (a: PriorityQueueItem, b: PriorityQueueItem): number => {
      return a.cost - b.cost
    },

    /**
     * Add a new item to the queue and ensure the highest priority element
     * is at the front of the queue.
     */
    push(this: PriorityQueueInstance, value: NodeId, cost: number): void {
      this.queue.push({ value, cost })
      this.queue.sort(this.sorter)
    },

    /**
     * Return the highest priority element in the queue.
     */
    pop(this: PriorityQueueInstance): PriorityQueueItem | undefined {
      return this.queue.shift()
    },

    empty(this: PriorityQueueInstance): boolean {
      return this.queue.length === 0
    }
  }
}


export default dijkstra