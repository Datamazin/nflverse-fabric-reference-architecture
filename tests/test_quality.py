from nfl_fabric_acquisition.quality import check_manifest_completeness


def test_manifest_completeness_passes_for_required_fields() -> None:
    check = check_manifest_completeness(
        [
            {
                "dataset": "pbp",
                "path": "out.parquet",
                "rows": 10,
                "columns": 2,
                "column_names": ["a", "b"],
                "status": "written",
            }
        ]
    )

    assert check["passed"] is True


def test_manifest_completeness_reports_missing_fields() -> None:
    check = check_manifest_completeness([{"dataset": "pbp"}])

    assert check["passed"] is False
    assert check["incomplete_outputs"][0]["missing"] == [
        "path",
        "rows",
        "columns",
        "column_names",
        "status",
    ]

