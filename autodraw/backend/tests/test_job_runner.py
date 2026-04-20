from __future__ import annotations

import shutil
import unittest

from autodraw.backend.app.config import settings
from autodraw.backend.app.schemas import CreateJobRequest
from autodraw.backend.app.services.job_runner import _JOBS, _LOCK, create_job, get_job


class JobRunnerStorageTest(unittest.TestCase):
    def test_image_edit_jobs_are_stored_under_edit_directory(self) -> None:
        request = CreateJobRequest(
            job_type="image-edit",
            prompt="make it blue",
            source_image_path="/tmp/source.png",
        )
        record = create_job(request, autostart=False)

        try:
            self.assertEqual(record.job_dir.parent, settings.edits_dir)
            self.assertTrue(record.job_dir.is_dir())

            with _LOCK:
                _JOBS.pop(record.job_id, None)

            restored = get_job(record.job_id)
            self.assertIsNotNone(restored)
            self.assertEqual(restored.job_dir.parent, settings.edits_dir)
        finally:
            with _LOCK:
                _JOBS.pop(record.job_id, None)
            shutil.rmtree(record.job_dir, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
