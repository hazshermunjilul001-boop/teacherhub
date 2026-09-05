# Corrective patch notes

This patch adds an explicit domain-entry panel for `GMRC (Elem)` and `Values Education (JHS)`. The panel stores `Cognitive Domain` and `Affective Domain` ratings in `grades.domain_scores`; the SF9 scorer mirrors their average for these new records only. Existing `GMRC/VE` records and all other subject calculations remain on the existing scoring path.

The term performance summary is now rendered in each E-Class Record print preview below its analysis tables, in addition to the Summary of Grades view. The linked teacher actual-name field remains stored in `section_collaborators.display_name` and is used for class-record teacher labels.
