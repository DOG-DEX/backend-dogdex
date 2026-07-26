import { Injectable } from '@nestjs/common';
import { uploadQueue } from '../../../utils/UploadQueue.util';
import { predictionQueue } from '../../../utils/PredictionQueue.util';

@Injectable()
export class PredictionQueueService {
  async enqueuePrediction(data: any): Promise<void> {
    await predictionQueue.add('prediction-job', data, { removeOnComplete: true });
  }

  async enqueueUpload(data: any): Promise<void> {
    await uploadQueue.add('upload-job', data, { removeOnComplete: true });
  }
}
