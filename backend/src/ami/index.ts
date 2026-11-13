import { config } from '../config';
import { AmiClient } from './client';

// one connection shared by the whole api
export const ami = new AmiClient(config.ami);