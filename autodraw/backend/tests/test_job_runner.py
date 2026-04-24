from __future__ import annotations

import shutil
import unittest
from unittest import mock

from autodraw.backend.app.config import settings
from autodraw.backend.app.schemas import (
    ArtifactInfo,
    CreateJobRequest,
    ReplayJobRequest,
    ResumeJobRequest,
)
from autodraw.backend.app.services.job_runner import (
    _JOBS,
    _LOCK,
    _persist_job_record,
    _run_job,
    cancel_job,
    create_job,
    create_replay_job,
    create_resume_job,
    get_job,
    get_job_response,
    list_job_items,
)


class JobRunnerStorageTest(unittest.TestCase):
    def test_autodraw_source_figure_can_skip_method_text_and_forces_stage_two(
        self,
    ) -> None:
        request = CreateJobRequest(
            job_type="autodraw",
            source_figure_path="/tmp/source-figure.png",
        )

        self.assertIsNone(request.method_text)
        self.assertEqual(request.start_stage, 2)

    def test_direct_svg_source_figure_forces_stage_four(self) -> None:
        request = CreateJobRequest(
            job_type="autodraw",
            source_figure_path="/tmp/source-figure.png",
            source_processing_mode="direct_svg",
            start_stage=2,
        )

        self.assertEqual(request.start_stage, 4)
        record = create_job(request, autostart=False)
        try:
            response = get_job_response(record.job_id)
            self.assertIsNotNone(response)
            self.assertEqual(response.min_start_stage, 4)
        finally:
            with _LOCK:
                _JOBS.pop(record.job_id, None)
            shutil.rmtree(record.job_dir, ignore_errors=True)

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

    def test_auto_resume_prefers_failed_stage_over_artifact_inference(self) -> None:
        request = CreateJobRequest(
            job_type="autodraw",
            source_figure_path="/tmp/source-figure.png",
        )
        source_record = create_job(request, autostart=False)

        resumed_record = None
        try:
            source_record.status = "failed"
            source_record.failed_stage = 4
            source_record.current_stage = 4
            source_record.last_success_stage = 3

            (source_record.job_dir / "figure.png").write_text("figure", encoding="utf-8")
            (source_record.job_dir / "samed.png").write_text("samed", encoding="utf-8")
            (source_record.job_dir / "boxlib.json").write_text("{}", encoding="utf-8")
            icons_dir = source_record.job_dir / "icons"
            icons_dir.mkdir(parents=True, exist_ok=True)
            (icons_dir / "icon_AF01.png").write_text("icon", encoding="utf-8")
            (source_record.job_dir / "template.svg").write_text("<svg />", encoding="utf-8")

            with mock.patch(
                "autodraw.backend.app.services.job_runner._EXECUTOR.submit"
            ) as submit_mock:
                resumed_record = create_resume_job(
                    source_record.job_id,
                    ResumeJobRequest(resume_from_stage="auto"),
                )

            self.assertEqual(resumed_record.resume_from_stage, 4)
            self.assertEqual(resumed_record.request_payload["start_stage"], 4)
            self.assertEqual(resumed_record.current_stage, 4)
            self.assertTrue((resumed_record.job_dir / "icons" / "icon_AF01.png").is_file())
            self.assertFalse((resumed_record.job_dir / "template.svg").exists())
            submit_mock.assert_called_once()
        finally:
            with _LOCK:
                _JOBS.pop(source_record.job_id, None)
                if resumed_record is not None:
                    _JOBS.pop(resumed_record.job_id, None)
            shutil.rmtree(source_record.job_dir, ignore_errors=True)
            if resumed_record is not None:
                shutil.rmtree(resumed_record.job_dir, ignore_errors=True)

    def test_running_job_response_scans_live_icon_artifacts(self) -> None:
        request = CreateJobRequest(
            job_type="autodraw",
            method_text="live icons",
        )
        record = create_job(request, autostart=False)

        try:
            record.status = "running"
            record.current_stage = 4
            (record.job_dir / "figure.png").write_text("figure", encoding="utf-8")
            icons_dir = record.job_dir / "icons"
            icons_dir.mkdir(parents=True, exist_ok=True)
            (icons_dir / "icon_AF01_nobg.png").write_text("icon", encoding="utf-8")

            response = get_job_response(record.job_id)

            self.assertIsNotNone(response)
            self.assertEqual(response.status, "running")
            self.assertIn("figure.png", [artifact.path for artifact in response.artifacts])
            self.assertIn(
                "icons/icon_AF01_nobg.png",
                [artifact.path for artifact in response.artifacts],
            )
        finally:
            with _LOCK:
                _JOBS.pop(record.job_id, None)
            shutil.rmtree(record.job_dir, ignore_errors=True)

    def test_list_job_items_uses_persisted_preview_without_live_scan(self) -> None:
        request = CreateJobRequest(
            job_type="autodraw",
            method_text="list me",
        )
        record = create_job(request, autostart=False)

        try:
            record.status = "running"
            record.current_stage = 2
            record.artifacts = [
                ArtifactInfo(
                    name="figure.png",
                    path="figure.png",
                    kind="figure",
                    size_bytes=6,
                    download_url=f"/api/jobs/{record.job_id}/artifacts/figure.png",
                )
            ]
            _persist_job_record(record)

            with mock.patch(
                "autodraw.backend.app.services.job_runner.scan_artifacts",
                side_effect=AssertionError("list_jobs should not scan live artifacts"),
            ):
                items = list_job_items(limit=20, offset=0)

            matched = next((item for item in items if item.job_id == record.job_id), None)
            self.assertIsNotNone(matched)
            self.assertEqual(
                matched.preview_url,
                f"/api/jobs/{record.job_id}/artifacts/figure.png",
            )
            self.assertEqual(matched.artifact_count, 1)
        finally:
            with _LOCK:
                _JOBS.pop(record.job_id, None)
            shutil.rmtree(record.job_dir, ignore_errors=True)

    def test_failed_job_list_preview_prefers_figure_over_icons(self) -> None:
        request = CreateJobRequest(
            job_type="autodraw",
            method_text="failed preview",
        )
        record = create_job(request, autostart=False)

        try:
            record.status = "failed"
            record.artifacts = [
                ArtifactInfo(
                    name="figure.png",
                    path="figure.png",
                    kind="figure",
                    size_bytes=10,
                    download_url=f"/api/jobs/{record.job_id}/artifacts/figure.png",
                ),
                ArtifactInfo(
                    name="icon_AF01_nobg.png",
                    path="icons/icon_AF01_nobg.png",
                    kind="icon",
                    size_bytes=6,
                    download_url=(
                        f"/api/jobs/{record.job_id}/artifacts/icons/icon_AF01_nobg.png"
                    ),
                ),
            ]
            _persist_job_record(record)

            items = list_job_items(limit=20, offset=0)
            matched = next((item for item in items if item.job_id == record.job_id), None)

            self.assertIsNotNone(matched)
            self.assertEqual(
                matched.preview_url,
                f"/api/jobs/{record.job_id}/artifacts/figure.png",
            )
        finally:
            with _LOCK:
                _JOBS.pop(record.job_id, None)
            shutil.rmtree(record.job_dir, ignore_errors=True)

    def test_replay_job_allows_succeeded_jobs_with_explicit_stage(self) -> None:
        request = CreateJobRequest(
            job_type="autodraw",
            method_text="replay me",
        )
        source_record = create_job(request, autostart=False)

        replay_record = None
        try:
            source_record.status = "succeeded"
            source_record.current_stage = 5
            source_record.last_success_stage = 5

            (source_record.job_dir / "figure.png").write_text("figure", encoding="utf-8")
            (source_record.job_dir / "samed.png").write_text("samed", encoding="utf-8")
            (source_record.job_dir / "boxlib.json").write_text("{}", encoding="utf-8")
            icons_dir = source_record.job_dir / "icons"
            icons_dir.mkdir(parents=True, exist_ok=True)
            (icons_dir / "icon_AF01_nobg.png").write_text("icon", encoding="utf-8")

            with mock.patch(
                "autodraw.backend.app.services.job_runner._EXECUTOR.submit"
            ) as submit_mock:
                replay_record = create_replay_job(
                    source_record.job_id,
                    ReplayJobRequest(start_stage=4),
                )

            self.assertEqual(replay_record.resume_from_stage, 4)
            self.assertEqual(replay_record.request_payload["start_stage"], 4)
            self.assertEqual(replay_record.current_stage, 4)
            self.assertTrue(
                (replay_record.job_dir / "icons" / "icon_AF01_nobg.png").is_file()
            )
            submit_mock.assert_called_once()
        finally:
            with _LOCK:
                _JOBS.pop(source_record.job_id, None)
                if replay_record is not None:
                    _JOBS.pop(replay_record.job_id, None)
            shutil.rmtree(source_record.job_dir, ignore_errors=True)
            if replay_record is not None:
                shutil.rmtree(replay_record.job_dir, ignore_errors=True)

    def test_replay_job_rejects_stage_one_for_source_figure_jobs(self) -> None:
        request = CreateJobRequest(
            job_type="autodraw",
            source_figure_path="/tmp/source-figure.png",
        )
        source_record = create_job(request, autostart=False)

        try:
            source_record.status = "succeeded"
            source_record.current_stage = 5
            source_record.last_success_stage = 5
            (source_record.job_dir / "figure.png").write_text("figure", encoding="utf-8")

            with self.assertRaisesRegex(
                ValueError, "start_stage must be at least 2"
            ):
                create_replay_job(
                    source_record.job_id,
                    ReplayJobRequest(start_stage=1),
                )
        finally:
            with _LOCK:
                _JOBS.pop(source_record.job_id, None)
            shutil.rmtree(source_record.job_dir, ignore_errors=True)

    def test_cancel_queued_job_marks_it_cancelled_immediately(self) -> None:
        request = CreateJobRequest(
            job_type="autodraw",
            method_text="cancel queued job",
        )
        record = create_job(request, autostart=False)

        try:
            cancelled = cancel_job(record.job_id)
            response = get_job_response(record.job_id)

            self.assertEqual(cancelled.status, "cancelled")
            self.assertIsNotNone(cancelled.finished_at)
            self.assertEqual(cancelled.error_message, "Job cancelled by user")
            self.assertIsNotNone(response)
            self.assertEqual(response.status, "cancelled")
            self.assertEqual(response.failed_stage, 1)

            log_text = record.log_path.read_text(encoding="utf-8")
            self.assertIn("[cancel] requested by user before execution", log_text)
        finally:
            with _LOCK:
                _JOBS.pop(record.job_id, None)
            shutil.rmtree(record.job_dir, ignore_errors=True)

    def test_running_job_can_be_cancelled_during_pipeline(self) -> None:
        request = CreateJobRequest(
            job_type="autodraw",
            method_text="cancel running job",
        )
        record = create_job(request, autostart=False)

        try:
            def fake_run_pipeline(*, request, output_dir, log_path, cancellation_check):
                self.assertIsNotNone(cancellation_check)
                cancel_job(record.job_id)
                cancellation_check(2, "步骤二：SAM3 分割")
                return {}

            with mock.patch(
                "autodraw.backend.app.services.job_runner.run_pipeline",
                side_effect=fake_run_pipeline,
            ):
                _run_job(record.job_id)

            response = get_job_response(record.job_id)
            self.assertIsNotNone(response)
            self.assertEqual(response.status, "cancelled")
            self.assertEqual(response.current_stage, 2)
            self.assertEqual(response.failed_stage, 2)

            log_text = record.log_path.read_text(encoding="utf-8")
            self.assertIn("[cancel] requested by user", log_text)
            self.assertIn(
                "[cancel] Job cancelled by user before 步骤二：SAM3 分割",
                log_text,
            )
        finally:
            with _LOCK:
                _JOBS.pop(record.job_id, None)
            shutil.rmtree(record.job_dir, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
