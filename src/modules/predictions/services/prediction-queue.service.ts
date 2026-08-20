import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import {
  uploadQueue,
  setUploadProcessor,
} from '../../../common/utils/UploadQueue.util';
import {
  predictionQueue,
  setPredictionProcessor,
} from '../../../common/utils/PredictionQueue.util';
import { PredictionService } from './prediction.service';

@Injectable()
export class PredictionQueueService implements OnModuleInit {
  constructor(
    @Inject(forwardRef(() => PredictionService))
    private readonly predictionService: PredictionService,
  ) {}

  onModuleInit() {
    setPredictionProcessor(async (data) => {
      await this.predictionService.processAsyncPrediction(data);
    });
    setUploadProcessor(async (data) => {
      await this.predictionService.processBackgroundUpload(data);
    });
  }

  async enqueuePrediction(data: any): Promise<void> {
    await predictionQueue.add('prediction-job', data, {
      removeOnComplete: true,
    });
  }

  async enqueueUpload(data: any): Promise<void> {
    await uploadQueue.add('upload-job', data, { removeOnComplete: true });
  }
}

