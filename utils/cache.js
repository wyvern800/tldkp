import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 180 }); // Cache items for 3 minutes

export default cache;