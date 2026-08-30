# Manual Grade Clearing and SF9 Grade-Level Fixes

Manual Grade Entry now reconciles the saved dataset. Before saving the new values, it deletes existing manual-grade rows for the current section, learners, and subject set; it then inserts only grades that are still 60 or higher. Clearing a field therefore removes the old value instead of restoring it on the next load.

Manage Section now derives and persists `grade_number` from the edited Grade Level text. SF9 also derives an effective numeric grade from the current Grade Level text before building subject rows, selecting the layout, loading grade data, and rendering or downloading the report. This prevents an old numeric grade from leaving the interface on the Grade 4–10 form after a section is changed to Grade 2 or another level.

The Grade 2 and Grade 3 elementary layouts remain active, and Grades 4–10 retain their existing layout. Production build completed successfully.
