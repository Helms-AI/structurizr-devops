workspace "Q1 2026 Architecture" "Architecture workspace for Q1 2026" {

    !identifiers hierarchical

    model {
        !include model/people.dsl
        !include model/external-systems.dsl
    }

    views {
        !include views/landscape.dsl
        !include styles/theme.dsl
    }

}
